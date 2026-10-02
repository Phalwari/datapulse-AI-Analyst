"""
Data Profiling & Statistical Anomaly Detection Utility for DataPulse AI.

Provides high-speed in-memory tabular data profiling using DuckDB:
- Column datatypes and null/missing rate bounds
- Numerical distribution statistics (min, max, avg, stddev, median, Q25, Q75, IQR)
- Statistical outlier identification using the 1.5 * IQR rule
- Categorical cardinality and top value frequency analysis
- Automated anomaly and data quality alerts
"""

import os
import duckdb
from typing import Dict, Any, List, Optional


def profile_duckdb_table(
    con: duckdb.DuckDBPyConnection,
    table_name: str,
    max_columns: int = 40,
) -> Dict[str, Any]:
    """
    Profile an existing table in an active DuckDB connection.
    """
    try:
        total_rows = con.execute(f'SELECT COUNT(*) FROM "{table_name}"').fetchone()[0]
    except Exception as e:
        return {"error": f"Failed to inspect table '{table_name}': {e}", "total_rows": 0, "columns": {}, "anomalies": []}

    if total_rows == 0:
        return {
            "table_name": table_name,
            "total_rows": 0,
            "total_columns": 0,
            "columns": {},
            "anomalies": ["Table is empty (0 records)."],
            "summary_text": f"Table '{table_name}' contains 0 records.",
        }

    try:
        desc = con.execute(f'DESCRIBE "{table_name}"').fetchall()
    except Exception as e:
        return {"error": f"Failed to describe table '{table_name}': {e}", "total_rows": total_rows, "columns": {}, "anomalies": []}

    profile: Dict[str, Any] = {
        "table_name": table_name,
        "total_rows": total_rows,
        "total_columns": len(desc),
        "columns": {},
        "anomalies": [],
    }

    numeric_highlights = []
    columns_to_inspect = desc[:max_columns]

    for col_info in columns_to_inspect:
        col_name = str(col_info[0])
        col_type = str(col_info[1]).upper()

        try:
            # Null count and distinct values
            null_res = con.execute(f'''
                SELECT 
                    COUNT(*) - COUNT("{col_name}") as null_cnt,
                    COUNT(DISTINCT "{col_name}") as distinct_cnt
                FROM "{table_name}"
            ''').fetchone()

            null_cnt = int(null_res[0]) if null_res and null_res[0] is not None else 0
            distinct_cnt = int(null_res[1]) if null_res and null_res[1] is not None else 0
            null_pct = round((null_cnt / total_rows) * 100, 2)

            col_meta: Dict[str, Any] = {
                "name": col_name,
                "type": col_type,
                "null_count": null_cnt,
                "null_pct": null_pct,
                "distinct_count": distinct_cnt,
            }

            # Anomaly alert: high null percentage
            if null_pct > 20.0:
                profile["anomalies"].append(
                    f"Column '{col_name}' has a high missing data rate ({null_pct}% nulls, {null_cnt}/{total_rows} rows)."
                )

            # Anomaly alert: constant column
            if distinct_cnt <= 1 and total_rows > 1:
                profile["anomalies"].append(
                    f"Column '{col_name}' is constant (only {distinct_cnt} unique value across all records)."
                )

            is_numeric = any(t in col_type for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "HUGEINT", "REAL", "NUMERIC"])
            valid_rows = total_rows - null_cnt

            if is_numeric and valid_rows > 0:
                num_stats = con.execute(f'''
                    SELECT 
                        MIN("{col_name}"),
                        MAX("{col_name}"),
                        AVG("{col_name}"),
                        STDDEV_POP("{col_name}"),
                        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{col_name}"),
                        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "{col_name}"),
                        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{col_name}")
                    FROM "{table_name}"
                    WHERE "{col_name}" IS NOT NULL
                ''').fetchone()

                if num_stats:
                    min_v, max_v, avg_v, std_v, q25, median, q75 = num_stats
                    iqr = (float(q75) - float(q25)) if (q75 is not None and q25 is not None) else 0.0

                    stats_dict = {
                        "min": round(float(min_v), 2) if min_v is not None else None,
                        "max": round(float(max_v), 2) if max_v is not None else None,
                        "avg": round(float(avg_v), 2) if avg_v is not None else None,
                        "std": round(float(std_v), 2) if std_v is not None else None,
                        "median": round(float(median), 2) if median is not None else None,
                        "q25": round(float(q25), 2) if q25 is not None else None,
                        "q75": round(float(q75), 2) if q75 is not None else None,
                        "iqr": round(float(iqr), 2),
                    }

                    # Outlier identification via 1.5 * IQR rule
                    if iqr > 0.0 and q25 is not None and q75 is not None:
                        lower_bound = float(q25) - 1.5 * iqr
                        upper_bound = float(q75) + 1.5 * iqr
                        outlier_res = con.execute(f'''
                            SELECT COUNT(*) 
                            FROM "{table_name}"
                            WHERE "{col_name}" < {lower_bound} OR "{col_name}" > {upper_bound}
                        ''').fetchone()

                        outlier_cnt = int(outlier_res[0]) if outlier_res and outlier_res[0] is not None else 0
                        stats_dict["outlier_count"] = outlier_cnt
                        stats_dict["outlier_bounds"] = [round(lower_bound, 2), round(upper_bound, 2)]

                        if outlier_cnt > 0:
                            outlier_pct = round((outlier_cnt / total_rows) * 100, 2)
                            if outlier_pct > 2.5:
                                profile["anomalies"].append(
                                    f"Column '{col_name}' contains {outlier_cnt} statistical outliers ({outlier_pct}% of rows outside [{round(lower_bound, 1)}, {round(upper_bound, 1)}])."
                                )

                    col_meta["stats"] = stats_dict
                    if len(numeric_highlights) < 5 and stats_dict["avg"] is not None:
                        numeric_highlights.append(
                            f"{col_name} (avg: {stats_dict['avg']}, min: {stats_dict['min']}, max: {stats_dict['max']})"
                        )

            elif not is_numeric and valid_rows > 0:
                top_rows = con.execute(f'''
                    SELECT CAST("{col_name}" AS VARCHAR) as val, COUNT(*) as cnt
                    FROM "{table_name}"
                    WHERE "{col_name}" IS NOT NULL
                    GROUP BY "{col_name}"
                    ORDER BY cnt DESC
                    LIMIT 3
                ''').fetchall()
                col_meta["top_values"] = [{"value": str(r[0])[:30], "count": int(r[1])} for r in top_rows]

            profile["columns"][col_name] = col_meta

        except Exception as col_err:
            profile["columns"][col_name] = {
                "name": col_name,
                "type": col_type,
                "error": str(col_err),
            }

    # Format human-readable narrative summary
    summary_lines = [f"Table '{table_name}': {total_rows:,} rows across {len(desc)} columns."]
    if numeric_highlights:
        summary_lines.append(f"- Key Metric Baselines: {', '.join(numeric_highlights)}.")
    if profile["anomalies"]:
        summary_lines.append(f"- Data Quality & Anomaly Alerts ({len(profile['anomalies'])} detected):")
        for alert in profile["anomalies"][:4]:
            summary_lines.append(f"  * {alert}")
    else:
        summary_lines.append("- Data Quality: High data integrity, no extreme anomalies or constant columns detected.")

    profile["summary_text"] = "\n".join(summary_lines)
    return profile


def profile_dataset_file(
    csv_path: str,
    table_name: str = "dataset_table",
    max_columns: int = 40,
) -> Dict[str, Any]:
    """
    Profile a CSV file by mounting it into an ephemeral DuckDB in-memory session.
    """
    if not os.path.exists(csv_path):
        return {"error": f"File not found: {csv_path}", "total_rows": 0, "columns": {}, "anomalies": []}

    clean_path = os.path.abspath(csv_path).replace("\\", "/")
    con = duckdb.connect(database=":memory:")
    try:
        con.execute(f"CREATE TABLE \"{table_name}\" AS SELECT * FROM read_csv_auto('{clean_path}')")
        return profile_duckdb_table(con, table_name, max_columns=max_columns)
    except Exception as e:
        return {"error": f"Failed to profile CSV '{csv_path}': {e}", "total_rows": 0, "columns": {}, "anomalies": []}
    finally:
        con.close()

import sys
import subprocess
import tempfile
import os
import shutil
import pandas as pd
import json

class SubprocessSandbox:
    def __init__(self, timeout_seconds: int = 15):
        self.timeout = timeout_seconds

    def execute_code(self, code: str, dataframe: pd.DataFrame) -> dict:
        """
        Executes python code against a given dataframe inside a temporary workspace,
        returning stdout, stderr, and any modifications/results.
        """
        # Create a secure temporary directory
        temp_dir = tempfile.mkdtemp()
        try:
            # Save the input data to CSV in the temp dir
            csv_path = os.path.join(temp_dir, "input_data.csv")
            dataframe.to_csv(csv_path, index=False)

            # Setup the execution wrapper
            wrapper_code = f"""
import pandas as pd
import numpy as np
import json
import sys

# Load the dataframe
df = pd.read_csv(r"{csv_path}")

# Run user code
try:
    # We execute the script in a clean namespace
    local_vars = {{"df": df}}
    exec('''{code}''', globals(), local_vars)
    
    # Extract any generated results if present
    if "result" in local_vars:
        print("---RESULT_START---")
        print(json.dumps(local_vars["result"]))
        print("---RESULT_END---")
except Exception as e:
    sys.stderr.write(str(e))
    sys.exit(1)
"""
            script_path = os.path.join(temp_dir, "run.py")
            with open(script_path, "w", encoding="utf-8") as f:
                f.write(wrapper_code)

            # Execute code as subprocess
            process = subprocess.run(
                [sys.executable, script_path],
                capture_output=True,
                text=True,
                timeout=self.timeout
            )

            stdout = process.stdout
            stderr = process.stderr
            return_code = process.returncode

            # Extract result JSON if printed
            result_data = None
            if "---RESULT_START---" in stdout:
                parts = stdout.split("---RESULT_START---")
                if len(parts) > 1:
                    subparts = parts[1].split("---RESULT_END---")
                    if len(subparts) > 0:
                        try:
                            result_data = json.loads(subparts[0].strip())
                        except Exception:
                            pass

            return {
                "stdout": stdout,
                "stderr": stderr,
                "success": return_code == 0,
                "result": result_data
            }

        except subprocess.TimeoutExpired:
            return {
                "stdout": "",
                "stderr": f"Execution timed out after {self.timeout} seconds.",
                "success": False,
                "result": None
            }
        except Exception as e:
            return {
                "stdout": "",
                "stderr": str(e),
                "success": False,
                "result": None
            }
        finally:
            # Clean up files safely
            shutil.rmtree(temp_dir, ignore_errors=True)

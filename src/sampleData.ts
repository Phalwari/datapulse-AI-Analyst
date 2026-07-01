export interface SampleDataset {
  id: string;
  name: string;
  description: string;
  csvContent: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: 'sales-perf',
    name: 'Sales & Marketing Performance 2025',
    description: 'Monthly marketing spend, direct revenue generated, total orders, and new customer signups.',
    csvContent: `"Month","Marketing_Spend","Revenue","Total_Orders","New_Signups","Region"
"January",12400,105000,1230,450,"North America"
"February",14500,118000,1410,510,"North America"
"March",18900,142000,1650,680,"Europe"
"April",15000,135000,1540,620,"Europe"
"May",22000,178000,2100,890,"North America"
"June",25000,195000,2450,1120,"North America"
"July",21000,162000,1950,810,"Asia Pacific"
"August",23000,168000,2020,840,"Asia Pacific"
"September",28000,210000,2580,1190,"Europe"
"October",32000,245000,2900,1400,"Europe"
"November",45000,312000,3800,1950,"North America"
"December",52000,385000,4500,2400,"North America"`
  },
  {
    id: 'saas-metrics',
    name: 'SaaS User Engagement Metrics',
    description: 'Weekly user activity statistics, billing plans, ticket ratios, and net promoter scores.',
    csvContent: `"Cohort_Week","Active_Users","Invoiced_Revenue","Support_Tickets","Upgrade_Count","NPS"
"W1",1240,45200,82,14,72
"W2",1350,48900,65,18,74
"W3",1410,52300,94,15,71
"W4",1490,56000,110,22,69
"W5",1580,61200,75,25,75
"W6",1720,68000,58,32,78
"W7",1810,72400,68,28,79
"W8",1940,79500,81,39,81
"W9",2050,84200,98,34,80
"W10",2200,91000,115,45,78
"W11",2350,98000,92,51,82
"W12",2500,105000,78,60,84`
  },
  {
    id: 'co2-temp',
    name: 'Global Climate & CO2 Tracking',
    description: 'Multi-decade climate data detailing carbon dioxide concentration, global average warmth anomalies, and count of extreme storms.',
    csvContent: `"Year","CO2_PPM","Temp_Anomaly","Extreme_Storms","Reforestation_Index"
1980,338.7,0.26,38,102
1985,346.1,0.12,42,105
1990,354.4,0.44,48,103
1995,360.8,0.46,55,108
2000,369.5,0.40,62,112
2005,379.8,0.67,78,110
2010,389.9,0.72,85,115
2015,400.8,0.90,98,118
2020,414.2,1.02,114,124
2021,416.4,0.85,118,125
2022,418.5,0.90,122,128
2023,421.1,1.15,135,130
2024,424.0,1.22,142,132`
  }
];

## Multi-instance robustness (K instances/size, mean over seeds per instance)

| n | K | NN+2opt (μ±σ) | ACO+2opt (μ±σ) | PSO (μ±σ) | ACO+2opt scurtare medie | win-rate | Wilcoxon p |
|---|---|---|---|---|---|---|---|
| 30 | 12 | 46.46±4.12 | 45.38±2.58 | 101.86±7.07 | +2.02%±4.30 | 9/12 | 0.1078 |
| 50 | 12 | 58.40±3.50 | 57.55±3.10 | 184.03±11.58 | +1.40%±2.01 | 9/12 | 0.0546 |
| 100 | 12 | 85.49±4.16 | 83.57±2.68 | 417.86±8.64 | +2.15%±2.46 | 11/12 | 0.0167 |

- n=30: ACO+2opt vs NN+2opt — scurtare medie +2.02%, câștig 9/12 instanțe, Wilcoxon z=-1.61, p=0.1078 → NEsemnificativ (p>=0.05)
- n=50: ACO+2opt vs NN+2opt — scurtare medie +1.40%, câștig 9/12 instanțe, Wilcoxon z=-1.92, p=0.0546 → NEsemnificativ (p>=0.05)
- n=100: ACO+2opt vs NN+2opt — scurtare medie +2.15%, câștig 11/12 instanțe, Wilcoxon z=-2.39, p=0.0167 → semnificativ (p<0.05)

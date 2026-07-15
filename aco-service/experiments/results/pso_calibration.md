## Comparație corectă ACO vs PSO — calibrare simetrică train/test

Calibrare pe 5 instanțe (train, 5 seed-uri), evaluare pe 6 instanțe disjuncte (test, 10 seed-uri).

| n | PSO implicit | PSO calibrat | ACO implicit | ACO calibrat | ACO vs PSO (calibrați) | ACO câștig | Wilcoxon p |
|---|---|---|---|---|---|---|---|
| 30 | 98.76±3.97 | 88.87±5.45 | 45.31±1.40 | 44.35±1.08 | −50.1% | 6/6 | 0.0360 |
| 50 | 182.00±12.21 | 170.19±11.41 | 59.39±2.95 | 58.40±2.72 | −65.7% | 6/6 | 0.0360 |

- n=30: PSO calibrat = {'swarm_size': 50, 'inertia': 0.9, 'cognitive': 1.5, 'social': 1.5} (câștig calibrare +10.0% vs implicit); ACO calibrat = {'alpha': 0.5, 'beta': 4.0, 'rho': 0.5}. ACO calibrat e cu 50.1% mai scurt decât PSO calibrat, câștig 6/6 instanțe test, Wilcoxon p=0.0360 → semnificativ (p<0.05)
- n=50: PSO calibrat = {'swarm_size': 50, 'inertia': 0.7, 'cognitive': 2.0, 'social': 2.0} (câștig calibrare +6.5% vs implicit); ACO calibrat = {'alpha': 0.5, 'beta': 4.0, 'rho': 0.5}. ACO calibrat e cu 65.7% mai scurt decât PSO calibrat, câștig 6/6 instanțe test, Wilcoxon p=0.0360 → semnificativ (p<0.05)

ROUTE_START_NAME = "UTCN Facultatea de Automatică și Calculatoare"
ROUTE_START_ADDRESS = "Strada George Barițiu 26-28, 400027 Cluj-Napoca"
ROUTE_START_LATITUDE = 46.7726428
ROUTE_START_LONGITUDE = 23.5852436

_COORD_EPS = 1e-5


def is_default_start(latitude: float, longitude: float) -> bool:
    return (
        abs(latitude - ROUTE_START_LATITUDE) < _COORD_EPS
        and abs(longitude - ROUTE_START_LONGITUDE) < _COORD_EPS
    )


def start_label_for(latitude: float, longitude: float, start_name: str | None) -> str:
    if start_name and start_name.strip():
        return start_name.strip()
    if is_default_start(latitude, longitude):
        return ROUTE_START_NAME
    return "Punct de plecare"

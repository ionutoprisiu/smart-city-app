import pytest
from fastapi.testclient import TestClient

import app.main as main_module


@pytest.fixture
def client() -> TestClient:
    main_module.warm_up_models = lambda: None
    app = main_module.create_app()
    with TestClient(app) as test_client:
        yield test_client



import pytest
from unittest.mock import MagicMock, patch
from features.alpha_hunter.service import AlphaHunterService

@pytest.fixture
def service():
    return AlphaHunterService()

@patch('modules.alpha_hunter_flow.AlphaHunterFlow')
def test_scan_flow_signals_delegates_to_flow(MockFlow, service):
    # Arrange
    mock_flow_instance = MockFlow.return_value
    mock_flow_instance.scan.return_value = {"signals": []}
    
    # Act
    result = service.scan_flow_signals(min_score=70, sector="Finance")
    
    # Assert
    # Access the property to trigger the lazy import and instantiation
    service.flow
    mock_flow_instance.scan.assert_called_with(
        min_score=70,
        method='m',
        flow_direction=None,
        price_filter=None,
        price_operator=None,
        max_results=20
    )
    assert result == {"signals": []}

@patch('modules.alpha_hunter_vpa.AlphaHunterVPA')
def test_get_vpa_analysis_delegates(MockVPA, service):
    # Arrange
    mock_vpa_instance = MockVPA.return_value
    mock_vpa_instance.analyze.return_value = {"analysis": "bullish"}
    
    # Act
    result = service.get_vpa_analysis(ticker="BBCA", lookback_days=30)
    
    # Assert
    service.vpa
    mock_vpa_instance.analyze.assert_called_with(
        ticker="BBCA",
        lookback_days=30,
        spike_date=None,
        min_ratio=2.0
    )
    assert result == {"analysis": "bullish"}

@patch('modules.database.DatabaseManager')
def test_manage_watchlist_add(MockDB, service):
    # Arrange
    mock_db = MockDB.return_value
    
    # Act
    result = service.manage_watchlist(ticker="BBRI", action="add", scan_data={})
    
    # Assert
    mock_db.add_to_watchlist.assert_called_with("BBRI", {})
    assert result["status"] == "added"
    assert result["ticker"] == "BBRI"

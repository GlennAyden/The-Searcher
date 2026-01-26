
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from features.neobdm.service import NeoBDMService

@pytest.fixture
def service():
    return NeoBDMService()

@patch('features.neobdm.service.DatabaseManager')
def test_get_latest_hot_signals(mock_db_manager, service):
    # Arrange
    mock_db = mock_db_manager.return_value
    mock_db.get_latest_hot_signals = MagicMock(return_value=[
        {'symbol': 'BBCA', 'signal_score': 90}
    ])
    
    # Act
    result = service.get_latest_hot_signals(method='m')
    
    # Assert
    mock_db.get_latest_hot_signals.assert_called_once()
    assert len(result) == 1
    assert result[0]['symbol'] == 'BBCA'

@patch('features.neobdm.service.DatabaseManager')
def test_get_broker_journey(mock_db_manager, service):
    # Arrange
    mock_db = mock_db_manager.return_value
    mock_db.get_broker_journey = MagicMock(return_value={
        'brokers': [{'broker_code': 'YP'}]
    })
    
    # Act
    result = service.get_broker_journey(
        ticker='BBRI',
        brokers=['YP'],
        start_date='2023-01-01',
        end_date='2023-01-31'
    )
    
    # Assert
    mock_db.get_broker_journey.assert_called_once_with('BBRI', ['YP'], '2023-01-01', '2023-01-31')
    assert len(result['brokers']) == 1

@pytest.mark.asyncio
@patch('modules.scraper_neobdm.NeoBDMScraper')
async def test_perform_full_sync(MockScraper, service):
    # Arrange
    mock_scraper = MockScraper.return_value
    mock_scraper.init_browser = AsyncMock()
    mock_scraper.login = AsyncMock(return_value=True)
    mock_scraper.get_market_summary = AsyncMock(return_value=(MagicMock(empty=False, to_dict=lambda **k: [{'symbol': 'TEST'}]), '2023-01-01'))
    mock_scraper.close = AsyncMock()
    
    service.repository.save_neobdm_record_batch = MagicMock()
    service._cleanup_today_records = MagicMock()
    
    # Act
    await service.perform_full_sync()
    
    # Assert
    # Should run 6 times (3 methods * 2 periods)
    assert mock_scraper.init_browser.call_count == 6
    assert mock_scraper.login.call_count == 6
    assert mock_scraper.get_market_summary.call_count == 6
    assert mock_scraper.close.call_count == 6
    assert service.repository.save_neobdm_record_batch.call_count == 6

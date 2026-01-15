"""Broker 5% CRUD routes."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db.connection import DatabaseConnection
from db.broker_five_repository import BrokerFiveRepository


router = APIRouter(prefix="/api", tags=["broker-five"])

# Ensure schema is initialized
DatabaseConnection()


class BrokerFiveCreate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    broker_code: str = Field(..., min_length=1, max_length=10)
    label: Optional[str] = Field(default=None, max_length=50)


class BrokerFiveUpdate(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=10)
    broker_code: str = Field(..., min_length=1, max_length=10)
    label: Optional[str] = Field(default=None, max_length=50)


@router.get("/broker-five")
def list_broker_five(ticker: str = Query(..., min_length=1, max_length=10)):
    repo = BrokerFiveRepository()
    ticker_code = ticker.strip().upper()
    return {"items": repo.list_brokers(ticker_code)}


@router.post("/broker-five", status_code=201)
def create_broker_five(payload: BrokerFiveCreate):
    repo = BrokerFiveRepository()
    ticker = payload.ticker.strip().upper()
    broker_code = payload.broker_code.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")
    if not broker_code:
        raise HTTPException(status_code=400, detail="Broker code is required.")
    result = repo.create_broker(ticker, broker_code, payload.label)
    if result is None:
        raise HTTPException(status_code=409, detail="Broker code already exists for this ticker.")
    return {"item": result}


@router.put("/broker-five/{broker_id}")
def update_broker_five(broker_id: int, payload: BrokerFiveUpdate):
    repo = BrokerFiveRepository()
    ticker = payload.ticker.strip().upper()
    broker_code = payload.broker_code.strip().upper()
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker is required.")
    if not broker_code:
        raise HTTPException(status_code=400, detail="Broker code is required.")
    result = repo.update_broker(broker_id, ticker, broker_code, payload.label)
    if result == "duplicate":
        raise HTTPException(status_code=409, detail="Broker code already exists for this ticker.")
    if result is None:
        raise HTTPException(status_code=404, detail="Broker code not found.")
    return {"item": result}


@router.delete("/broker-five/{broker_id}")
def delete_broker_five(broker_id: int, ticker: str = Query(..., min_length=1, max_length=10)):
    repo = BrokerFiveRepository()
    ticker_code = ticker.strip().upper()
    ok = repo.delete_broker(broker_id, ticker_code)
    if not ok:
        raise HTTPException(status_code=404, detail="Broker code not found.")
    return {"deleted": True}

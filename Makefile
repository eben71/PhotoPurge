SHELL := /bin/bash

PNPM := pnpm
UV := uv

.PHONY: setup dev lint format format-check typecheck test build hooks

_dev_compose := docker compose -f docker-compose.yml -p photoprune

setup:
	$(PNPM) install
	cd apps/api && $(UV) venv && $(UV) pip install -r requirements-dev.lock
	cd apps/worker && $(UV) venv && $(UV) pip install -r requirements-dev.lock

dev:
	$(_dev_compose) up --build

lint:
	$(PNPM) lint
	cd apps/api && $(UV) run ruff check app tests
	cd apps/worker && $(UV) run ruff check app tests

format:
	$(PNPM) format
	cd apps/api && $(UV) run black app tests
	cd apps/worker && $(UV) run black app tests

format-check:
	$(PNPM) format:check
	cd apps/api && $(UV) run black --check app tests
	cd apps/worker && $(UV) run black --check app tests

typecheck:
	$(PNPM) typecheck
	cd apps/api && $(UV) run mypy app
	cd apps/worker && $(UV) run mypy app

test:
	$(PNPM) test
	cd apps/api && $(UV) run pytest
	cd apps/worker && $(UV) run pytest

build:
	$(PNPM) build
	cd apps/api && $(UV) run python -m compileall app
	cd apps/worker && $(UV) run python -m compileall app

hooks:
	$(PNPM) lefthook install

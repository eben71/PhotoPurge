SHELL := /bin/bash

PNPM := pnpm
# Resolve uv from PATH, falling back to common install locations
UV ?= $(shell \
	if command -v uv >/dev/null 2>&1; then command -v uv; \
	elif [ -x "$(HOME)/.local/bin/uv" ]; then printf '%s' "$(HOME)/.local/bin/uv"; \
	elif [ -x "/opt/homebrew/bin/uv" ]; then printf '%s' "/opt/homebrew/bin/uv"; \
	fi)

ifeq ($(UV),)
$(error uv is required. Install via "brew install uv" or "curl -LsSf https://astral.sh/uv/install.sh | sh", ensure it is on PATH, or set UV=/full/path/to/uv)
endif

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

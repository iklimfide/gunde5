#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deprecated alias — run fix-mojibake.py instead (never use cp1254 wholesale)."""
import runpy
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().parent / "fix-mojibake.py"), run_name="__main__")

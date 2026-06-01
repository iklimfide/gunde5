#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Eski ad — scripts/gunde5-txt-to-sql.py kullanın."""

import runpy
import sys
from pathlib import Path

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).with_name("gunde5-txt-to-sql.py")), run_name="__main__")

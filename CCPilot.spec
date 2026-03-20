# -*- mode: python ; coding: utf-8 -*-
# CCPilot PyInstaller spec
# 빌드: pyinstaller CCPilot.spec

import sys
import importlib.util
from pathlib import Path

ROOT = Path(SPECPATH)

# pywebview 패키지 경로 동적 탐색
_webview_spec = importlib.util.find_spec('webview')
_webview_dir = str(Path(_webview_spec.origin).parent) if _webview_spec else None

_datas = [(str(ROOT / 'public'), 'public')]
if _webview_dir:
    _datas.append((_webview_dir, 'webview'))

a = Analysis(
    [str(ROOT / 'main.py')],
    pathex=[str(ROOT)],
    binaries=[],
    datas=_datas,
    hiddenimports=[
        'ccpilot.utils',
        'ccpilot.types',
        'ccpilot.db',
        'ccpilot.http_utils',
        'ccpilot.session',
        'ccpilot.projects',
        'ccpilot.planning',
        'ccpilot.refactoring',
        'ccpilot.enhancement',
        'ccpilot.websocket',
        'ccpilot.routes',
        # pywebview 백엔드
        'webview',
        'webview.platforms.winforms',
        'clr',
        'System',
        'System.Windows.Forms',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'unittest', 'pydoc', 'doctest', 'test',
    ],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='CCPilot',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='public/logo.ico',
)

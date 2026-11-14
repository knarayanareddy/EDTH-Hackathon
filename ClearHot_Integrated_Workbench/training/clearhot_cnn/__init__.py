"""ClearHot offline CNN loop (local only).

Everything here runs on the user's machine. Nothing in this package opens a network
socket, and no function uploads recordings, frames, labels, weights or reports.
"""
TOOL_VERSION = "2.0.0"
COUNT_MAX = 16383  # 14-bit count domain used by the original ClearHot algorithms

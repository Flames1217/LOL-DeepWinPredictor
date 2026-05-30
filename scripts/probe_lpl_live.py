import argparse
import json
import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from Data_CrawlProcess.lpl_live_probe import lpl_live_candidates, probe_lpl_live_sources


def main() -> None:
    parser = argparse.ArgumentParser(description="Probe LPL official match detail updates.")
    parser.add_argument("--match-id", default=None, help="LPL bMatchId. Defaults to nearest LPL match.")
    parser.add_argument("--interval", type=int, default=15, help="Seconds between probes.")
    parser.add_argument("--count", type=int, default=1, help="Number of probes to run.")
    parser.add_argument("--no-save", action="store_true", help="Do not save snapshots for diffing.")
    parser.add_argument("--candidates", action="store_true", help="Only print nearest LPL candidates.")
    args = parser.parse_args()

    if args.candidates:
        print(json.dumps(lpl_live_candidates(), ensure_ascii=False, indent=2))
        return

    for index in range(max(1, args.count)):
        payload = probe_lpl_live_sources(match_id=args.match_id, save=not args.no_save)
        summary = {
            "checkedAt": payload.get("checkedAt"),
            "matchId": payload.get("matchId"),
            "ok": payload.get("ok"),
            "matchStatus": (payload.get("compact") or {}).get("matchStatus"),
            "games": len((payload.get("compact") or {}).get("games") or []),
            "changedFieldCount": payload.get("changedFieldCount"),
            "liveHintChanges": [
                row for row in payload.get("changedFields", []) if row.get("liveHint")
            ][:20],
            "snapshotPath": payload.get("snapshotPath"),
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        if index < args.count - 1:
            time.sleep(max(1, args.interval))


if __name__ == "__main__":
    main()

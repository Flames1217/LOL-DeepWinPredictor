# -*- coding: utf-8 -*-
"""One-shot data sync entrypoint for the current JSON/MySQL data pipeline."""

from Data_CrawlProcess.Other import Other
from Data_CrawlProcess.champion_stats_sync import sync_opgg_stats
from Data_CrawlProcess.team_player_stats_sync import sync_pro_stats
from tool_utils.log_utils import RichLogger
from tool_utils.progress_utils import RichProgressUtils

rich_logger = RichLogger()


def main() -> None:
    progress = RichProgressUtils()
    progress.start()
    try:
        rich_logger.info("[main] Syncing base hero/team JSON and MySQL hero win-rate table")
        Other(rich_progress=progress).main()

        rich_logger.info("[main] Syncing OP.GG champion stats cache")
        sync_opgg_stats()

        rich_logger.info("[main] Syncing pro team/player/schedule cache")
        sync_pro_stats()

        rich_logger.info("[main] Data sync completed")
    finally:
        progress.stop()


if __name__ == "__main__":
    main()

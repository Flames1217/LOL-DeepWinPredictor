import os
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

import pymysql

from tool_utils.log_utils import RichLogger

rich_logger = RichLogger()


def _mysql_url() -> str:
    return os.getenv("MYSQL_URL") or os.getenv("DATABASE_URL") or ""


def _connection_args(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    return {
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 3306,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "database": (parsed.path or "/").lstrip("/"),
        "charset": query.get("charset", ["utf8mb4"])[0] or "utf8mb4",
    }


class Connect:
    def __enter__(self):
        url = _mysql_url()
        if not url:
            raise RuntimeError("MYSQL_URL is required for site stats")
        self.conn = pymysql.connect(**_connection_args(url))
        self.cur = self.conn.cursor()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            self.cur.close()
        except Exception as exc:
            rich_logger.error(f"close MySQL cursor failed: {exc}")
        try:
            self.conn.close()
        except Exception as exc:
            rich_logger.error(f"close MySQL connection failed: {exc}")


class DBHelper:
    @classmethod
    def find_one(cls, sql: str) -> Any | None:
        try:
            with Connect() as db:
                db.cur.execute(sql)
                return db.cur.fetchone()
        except Exception as exc:
            rich_logger.error(f"MySQL query failed: {sql}; error={exc}")
            return None

    @classmethod
    def find_para(cls, sql: str, params: tuple[Any, ...]) -> tuple[Any, ...] | None:
        try:
            with Connect() as db:
                db.cur.execute(sql, params)
                return db.cur.fetchall()
        except Exception as exc:
            rich_logger.error(f"MySQL query failed: {sql}; params={params}; error={exc}")
            return None

    @classmethod
    def modify(cls, sql: str) -> None:
        try:
            with Connect() as db:
                db.cur.execute(sql)
                db.conn.commit()
        except Exception as exc:
            rich_logger.error(f"MySQL update failed: {sql}; error={exc}")

    @classmethod
    def modify_para(cls, sql: str, params: tuple[Any, ...]) -> None:
        try:
            with Connect() as db:
                db.cur.execute(sql, params)
                db.conn.commit()
        except Exception as exc:
            rich_logger.error(f"MySQL update failed: {sql}; params={params}; error={exc}")


class MySQLUtils:
    def __init__(self):
        self.db_helper = DBHelper
        self.enabled = bool(_mysql_url())
        if self.enabled:
            self.init_database()

    def record_visit(self, ip: str) -> None:
        if not self.enabled:
            return
        result = self.db_helper.find_para(
            "SELECT visit_count FROM site_stats WHERE visitor_ip=%s",
            (ip,),
        )
        if result and len(result) > 0:
            self.db_helper.modify_para(
                "UPDATE site_stats SET visit_count=visit_count+1 WHERE visitor_ip=%s",
                (ip,),
            )
        else:
            self.db_helper.modify_para(
                "INSERT INTO site_stats (visit_count, visitor_ip) VALUES (1, %s)",
                (ip,),
            )

    def get_site_stats(self) -> tuple[int, int]:
        if not self.enabled:
            return 0, 0
        total_result = self.db_helper.find_one("SELECT SUM(visit_count) FROM site_stats")
        user_result = self.db_helper.find_one("SELECT COUNT(*) FROM site_stats")
        total = total_result[0] if isinstance(total_result, tuple) and total_result else 0
        users = user_result[0] if isinstance(user_result, tuple) and user_result else 0
        return int(total or 0), int(users or 0)

    def init_database(self) -> None:
        if not self.enabled:
            return
        self.db_helper.modify(
            """
            CREATE TABLE IF NOT EXISTS site_stats (
                id INT PRIMARY KEY AUTO_INCREMENT,
                visit_count INT NOT NULL DEFAULT 0,
                visitor_ip VARCHAR(45) NOT NULL,
                last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )

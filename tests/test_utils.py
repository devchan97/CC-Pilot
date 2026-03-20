"""utils.py 단위 테스트 — parse_claude_json, build_claude_cmd, resolve_cwd"""
import sys
import os
import unittest
import tempfile
import shutil

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from ccpilot.utils import parse_claude_json, resolve_cwd, default_projects_dir


class TestParseClaudeJson(unittest.TestCase):

    def test_plain_json(self):
        """완전한 JSON 문자열 파싱"""
        result = parse_claude_json('{"summary": "test", "agents": []}')
        self.assertEqual(result["summary"], "test")
        self.assertEqual(result["agents"], [])

    def test_json_with_markdown_fences(self):
        """```json 코드블록 감싸진 경우"""
        text = '```json\n{"summary": "wrapped", "agents": []}\n```'
        result = parse_claude_json(text)
        self.assertEqual(result["summary"], "wrapped")

    def test_json_with_plain_fences(self):
        """``` 코드블록 (언어 없음)"""
        text = '```\n{"summary": "plain fence"}\n```'
        result = parse_claude_json(text)
        self.assertEqual(result["summary"], "plain fence")

    def test_json_embedded_in_text(self):
        """JSON 앞뒤로 설명 텍스트가 있는 경우"""
        text = 'Here is my plan:\n{"summary": "embedded", "agents": []}\nDone.'
        result = parse_claude_json(text)
        self.assertEqual(result["summary"], "embedded")

    def test_nested_braces(self):
        """중첩 중괄호 — 탐욕적 정규식이면 실패하는 케이스"""
        text = '{"outer": {"inner": "value"}, "list": [1,2,3]}'
        result = parse_claude_json(text)
        self.assertEqual(result["outer"]["inner"], "value")
        self.assertEqual(result["list"], [1, 2, 3])

    def test_multiple_json_blocks(self):
        """여러 JSON 블록이 있을 때 첫 번째만 파싱"""
        text = '{"first": 1}\n{"second": 2}'
        result = parse_claude_json(text)
        self.assertEqual(result["first"], 1)
        self.assertNotIn("second", result)

    def test_invalid_json_returns_error(self):
        """파싱 불가 입력 → error 키 반환"""
        result = parse_claude_json("전혀 JSON이 아닌 텍스트")
        self.assertIn("error", result)

    def test_empty_string_returns_error(self):
        result = parse_claude_json("")
        self.assertIn("error", result)

    def test_unicode_in_json(self):
        """한글 등 유니코드 포함"""
        text = '{"summary": "프로젝트 요약", "agents": []}'
        result = parse_claude_json(text)
        self.assertEqual(result["summary"], "프로젝트 요약")


class TestResolveCwd(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_explicit_path_created(self):
        """명시 경로 → 폴더 생성"""
        target = os.path.join(self.tmp, "myproject")
        result = resolve_cwd(target)
        self.assertTrue(os.path.isdir(result))
        self.assertEqual(result, target)

    def test_explicit_path_with_subdir(self):
        """명시 경로 + subdir → 중첩 폴더 생성"""
        target = os.path.join(self.tmp, "root")
        result = resolve_cwd(target, "agent1")
        self.assertTrue(os.path.isdir(result))
        self.assertTrue(result.endswith("agent1"))

    def test_empty_path_uses_default(self):
        """빈 문자열 → default_projects_dir() 하위"""
        result = resolve_cwd("")
        default = str(default_projects_dir())
        self.assertEqual(result, default)

    def test_empty_path_with_subdir(self):
        """빈 경로 + subdir → projects/{subdir}/"""
        result = resolve_cwd("", "myagent")
        self.assertTrue(result.endswith("myagent"))
        self.assertTrue(os.path.isdir(result))


if __name__ == "__main__":
    unittest.main()

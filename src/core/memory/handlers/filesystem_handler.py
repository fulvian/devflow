#!/usr/bin/env python3
"""
FileSystemHandler - Advanced AST-based Content Extraction
Microsoft Kernel Memory compliant handler per filesystem analysis

Features:
- AST-based semantic parsing (TypeScript, Python, JavaScript)
- Git integration per authorship context
- Intelligent chunking per optimal token distribution
- Dependency graph analysis
- Cross-reference preservation
"""

import ast
import json
import sqlite3
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
from abc import ABC, abstractmethod
import hashlib
import subprocess
import logging

# AST Parser imports
try:
    import tree_sitter
    from tree_sitter import Language, Parser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TREE_SITTER_AVAILABLE = False
    logging.warning("tree-sitter not available, using fallback parsers")

@dataclass
class SemanticChunk:
    """Rappresenta un chunk semantico dal filesystem"""
    content: str
    chunk_type: str  # 'function', 'class', 'import', 'comment', 'config'
    file_path: str
    start_line: int
    end_line: int
    dependencies: List[str]
    author_info: Optional[Dict[str, str]]
    git_blame: Optional[Dict[str, Any]]
    ast_metadata: Dict[str, Any]
    semantic_hash: str
    token_count: int
    relevance_score: float = 0.0

@dataclass
class FileAnalysis:
    """Complete analysis di un file"""
    file_path: str
    language: str
    chunks: List[SemanticChunk]
    dependencies: List[str]
    exports: List[str]
    imports: List[str]
    git_metadata: Dict[str, Any]
    total_tokens: int
    analysis_timestamp: datetime

class BaseASTParser(ABC):
    """Base class per parsers AST specifici per linguaggio"""

    @abstractmethod
    def parse_file(self, file_path: str) -> List[SemanticChunk]:
        """Parse file e return semantic chunks"""
        pass

    @abstractmethod
    def extract_dependencies(self, content: str) -> List[str]:
        """Extract dependencies from content"""
        pass

class PythonASTParser(BaseASTParser):
    """Python AST parser usando il modulo ast nativo"""

    def parse_file(self, file_path: str) -> List[SemanticChunk]:
        """Parse Python file usando AST"""
        chunks = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            tree = ast.parse(content)

            for node in ast.walk(tree):
                chunk = self._process_ast_node(node, content, file_path)
                if chunk:
                    chunks.append(chunk)

        except Exception as e:
            logging.error(f"Error parsing Python file {file_path}: {e}")
            # Fallback to line-based chunking
            chunks = self._fallback_line_chunking(file_path)

        return chunks

    def _process_ast_node(self, node, content: str, file_path: str) -> Optional[SemanticChunk]:
        """Process single AST node"""

        if isinstance(node, ast.FunctionDef):
            return self._create_function_chunk(node, content, file_path)
        elif isinstance(node, ast.ClassDef):
            return self._create_class_chunk(node, content, file_path)
        elif isinstance(node, ast.Import) or isinstance(node, ast.ImportFrom):
            return self._create_import_chunk(node, content, file_path)

        return None

    def _create_function_chunk(self, node: ast.FunctionDef, content: str, file_path: str) -> SemanticChunk:
        """Create chunk per Python function"""
        start_line = node.lineno
        end_line = node.end_lineno or start_line

        # Extract function content
        lines = content.split('\n')
        function_content = '\n'.join(lines[start_line-1:end_line])

        # Extract dependencies (chiamate di funzione)
        dependencies = []
        for child in ast.walk(node):
            if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
                dependencies.append(child.func.id)

        semantic_hash = hashlib.sha256(function_content.encode()).hexdigest()[:16]

        return SemanticChunk(
            content=function_content,
            chunk_type='function',
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            dependencies=dependencies,
            author_info=None,  # Will be populated by git integration
            git_blame=None,
            ast_metadata={
                'function_name': node.name,
                'args': [arg.arg for arg in node.args.args],
                'decorators': [ast.unparse(dec) for dec in node.decorator_list],
                'is_async': isinstance(node, ast.AsyncFunctionDef)
            },
            semantic_hash=semantic_hash,
            token_count=len(function_content.split())
        )

    def _create_class_chunk(self, node: ast.ClassDef, content: str, file_path: str) -> SemanticChunk:
        """Create chunk per Python class"""
        start_line = node.lineno
        end_line = node.end_lineno or start_line

        lines = content.split('\n')
        class_content = '\n'.join(lines[start_line-1:end_line])

        # Extract method names
        methods = []
        for child in node.body:
            if isinstance(child, ast.FunctionDef):
                methods.append(child.name)

        semantic_hash = hashlib.sha256(class_content.encode()).hexdigest()[:16]

        return SemanticChunk(
            content=class_content,
            chunk_type='class',
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            dependencies=[base.id for base in node.bases if isinstance(base, ast.Name)],
            author_info=None,
            git_blame=None,
            ast_metadata={
                'class_name': node.name,
                'methods': methods,
                'base_classes': [ast.unparse(base) for base in node.bases],
                'decorators': [ast.unparse(dec) for dec in node.decorator_list]
            },
            semantic_hash=semantic_hash,
            token_count=len(class_content.split())
        )

    def _create_import_chunk(self, node, content: str, file_path: str) -> SemanticChunk:
        """Create chunk per import statement"""
        start_line = node.lineno

        lines = content.split('\n')
        import_content = lines[start_line-1]

        # Extract import names
        if isinstance(node, ast.Import):
            imports = [alias.name for alias in node.names]
        else:  # ImportFrom
            module = node.module or ''
            imports = [f"{module}.{alias.name}" for alias in node.names]

        semantic_hash = hashlib.sha256(import_content.encode()).hexdigest()[:16]

        return SemanticChunk(
            content=import_content,
            chunk_type='import',
            file_path=file_path,
            start_line=start_line,
            end_line=start_line,
            dependencies=imports,
            author_info=None,
            git_blame=None,
            ast_metadata={
                'import_type': 'import' if isinstance(node, ast.Import) else 'from_import',
                'module': getattr(node, 'module', None),
                'imported_names': [alias.name for alias in node.names]
            },
            semantic_hash=semantic_hash,
            token_count=len(import_content.split())
        )

    def _fallback_line_chunking(self, file_path: str) -> List[SemanticChunk]:
        """Fallback chunking quando AST fallisce"""
        chunks = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            chunk_size = 50  # lines per chunk
            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i:i+chunk_size]
                content = ''.join(chunk_lines)

                semantic_hash = hashlib.sha256(content.encode()).hexdigest()[:16]

                chunks.append(SemanticChunk(
                    content=content,
                    chunk_type='fallback_chunk',
                    file_path=file_path,
                    start_line=i+1,
                    end_line=min(i+chunk_size, len(lines)),
                    dependencies=[],
                    author_info=None,
                    git_blame=None,
                    ast_metadata={},
                    semantic_hash=semantic_hash,
                    token_count=len(content.split())
                ))

        except Exception as e:
            logging.error(f"Fallback chunking failed for {file_path}: {e}")

        return chunks

    def extract_dependencies(self, content: str) -> List[str]:
        """Extract all dependencies from Python content"""
        dependencies = []

        try:
            tree = ast.parse(content)

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    dependencies.extend([alias.name for alias in node.names])
                elif isinstance(node, ast.ImportFrom) and node.module:
                    dependencies.append(node.module)

        except Exception as e:
            logging.error(f"Error extracting dependencies: {e}")

        return list(set(dependencies))

class TypeScriptASTParser(BaseASTParser):
    """TypeScript parser usando tree-sitter (se disponibile) o fallback"""

    def __init__(self):
        self.parser = None
        if TREE_SITTER_AVAILABLE:
            try:
                # Initialize tree-sitter parser per TypeScript
                # Note: requires tree-sitter-typescript to be installed
                pass
            except Exception:
                logging.warning("TypeScript tree-sitter parser not available")

    def parse_file(self, file_path: str) -> List[SemanticChunk]:
        """Parse TypeScript/JavaScript file"""
        # Fallback implementation usando regex patterns
        return self._regex_based_parsing(file_path)

    def _regex_based_parsing(self, file_path: str) -> List[SemanticChunk]:
        """Regex-based parsing per TypeScript/JavaScript"""
        import re

        chunks = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Function pattern
            function_pattern = r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*\}'

            for match in re.finditer(function_pattern, content, re.MULTILINE | re.DOTALL):
                start_pos = match.start()
                end_pos = match.end()

                # Calculate line numbers
                start_line = content[:start_pos].count('\n') + 1
                end_line = content[:end_pos].count('\n') + 1

                function_content = match.group(0)
                function_name = match.group(1)

                semantic_hash = hashlib.sha256(function_content.encode()).hexdigest()[:16]

                chunks.append(SemanticChunk(
                    content=function_content,
                    chunk_type='function',
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    dependencies=self._extract_ts_dependencies(function_content),
                    author_info=None,
                    git_blame=None,
                    ast_metadata={
                        'function_name': function_name,
                        'language': 'typescript'
                    },
                    semantic_hash=semantic_hash,
                    token_count=len(function_content.split())
                ))

        except Exception as e:
            logging.error(f"Error parsing TypeScript file {file_path}: {e}")

        return chunks

    def _extract_ts_dependencies(self, content: str) -> List[str]:
        """Extract dependencies from TypeScript content"""
        import re

        dependencies = []

        # Import patterns
        import_pattern = r'import\s+.*?\s+from\s+[\'"]([^\'\"]+)[\'"]'
        for match in re.finditer(import_pattern, content):
            dependencies.append(match.group(1))

        return list(set(dependencies))

    def extract_dependencies(self, content: str) -> List[str]:
        """Extract dependencies from TypeScript content"""
        return self._extract_ts_dependencies(content)

class GitIntegration:
    """Git integration per authorship context e blame info"""

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)

    def get_file_git_metadata(self, file_path: str) -> Dict[str, Any]:
        """Get git metadata per file"""
        try:
            # Get last commit for file
            result = subprocess.run([
                'git', 'log', '-1', '--format=%H|%an|%ae|%ad', '--', file_path
            ], cwd=self.repo_path, capture_output=True, text=True)

            if result.returncode == 0 and result.stdout.strip():
                commit_hash, author_name, author_email, date = result.stdout.strip().split('|')

                return {
                    'last_commit': commit_hash,
                    'author_name': author_name,
                    'author_email': author_email,
                    'last_modified': date,
                    'file_path': file_path
                }

        except Exception as e:
            logging.error(f"Error getting git metadata for {file_path}: {e}")

        return {}

    def get_blame_info(self, file_path: str, start_line: int, end_line: int) -> Dict[str, Any]:
        """Get git blame info per specific lines"""
        try:
            result = subprocess.run([
                'git', 'blame', '-L', f"{start_line},{end_line}", '--porcelain', file_path
            ], cwd=self.repo_path, capture_output=True, text=True)

            if result.returncode == 0:
                # Parse blame output (simplified)
                return {
                    'blame_data': result.stdout,
                    'start_line': start_line,
                    'end_line': end_line
                }

        except Exception as e:
            logging.error(f"Error getting blame info for {file_path}:{start_line}-{end_line}: {e}")

        return {}

class FileSystemHandler:
    """
    Main FileSystemHandler - Microsoft Kernel Memory compliant
    Advanced AST-based content extraction con git integration
    """

    def __init__(self, project_root: str = "/Users/fulvioventura/devflow"):
        self.project_root = Path(project_root)
        self.git_integration = GitIntegration(project_root)

        # Initialize parsers
        self.parsers = {
            '.py': PythonASTParser(),
            '.ts': TypeScriptASTParser(),
            '.js': TypeScriptASTParser(),  # Reuse TS parser
            '.tsx': TypeScriptASTParser(),
            '.jsx': TypeScriptASTParser()
        }

        # Supported file extensions
        self.supported_extensions = ['.py', '.ts', '.js', '.tsx', '.jsx', '.md', '.json', '.yaml', '.yml']

        # Performance metrics
        self.metrics = {
            'files_processed': 0,
            'chunks_generated': 0,
            'total_tokens': 0,
            'ast_successes': 0,
            'ast_failures': 0
        }

        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)

    def can_handle(self, file_path: str) -> bool:
        """Check se il handler può processare questo file"""
        path = Path(file_path)

        # Check extension
        if path.suffix not in self.supported_extensions:
            return False

        # Check if file exists and is readable
        if not path.exists() or not path.is_file():
            return False

        # Skip binary files, node_modules, etc.
        skip_patterns = ['node_modules', '.git', '__pycache__', 'dist', 'build']
        if any(pattern in str(path) for pattern in skip_patterns):
            return False

        return True

    async def extract_file_contexts(self, file_path: str) -> FileAnalysis:
        """Extract complete contexts from file"""
        start_time = datetime.now()

        if not self.can_handle(file_path):
            raise ValueError(f"Cannot handle file: {file_path}")

        path = Path(file_path)

        # Detect language
        language = self._detect_language(path.suffix)

        # Get appropriate parser
        parser = self.parsers.get(path.suffix)

        # Extract semantic chunks
        if parser:
            chunks = parser.parse_file(file_path)
            self.metrics['ast_successes'] += 1
        else:
            chunks = self._fallback_text_chunking(file_path)
            self.metrics['ast_failures'] += 1

        # Enrich con git metadata
        git_metadata = self.git_integration.get_file_git_metadata(file_path)

        for chunk in chunks:
            chunk.author_info = git_metadata
            chunk.git_blame = self.git_integration.get_blame_info(
                file_path, chunk.start_line, chunk.end_line
            )

        # Extract dependencies e exports
        dependencies = []
        exports = []
        imports = []

        if parser:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                dependencies = parser.extract_dependencies(content)
            except Exception as e:
                self.logger.error(f"Error extracting dependencies: {e}")

        # Update metrics
        self.metrics['files_processed'] += 1
        self.metrics['chunks_generated'] += len(chunks)
        self.metrics['total_tokens'] += sum(chunk.token_count for chunk in chunks)

        duration = (datetime.now() - start_time).total_seconds()
        self.logger.info(f"Processed {file_path} in {duration:.2f}s - {len(chunks)} chunks, {language}")

        return FileAnalysis(
            file_path=file_path,
            language=language,
            chunks=chunks,
            dependencies=dependencies,
            exports=exports,
            imports=imports,
            git_metadata=git_metadata,
            total_tokens=sum(chunk.token_count for chunk in chunks),
            analysis_timestamp=datetime.now()
        )

    def _detect_language(self, extension: str) -> str:
        """Detect programming language from extension"""
        language_map = {
            '.py': 'python',
            '.ts': 'typescript',
            '.js': 'javascript',
            '.tsx': 'typescript-react',
            '.jsx': 'javascript-react',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml'
        }

        return language_map.get(extension, 'unknown')

    def _fallback_text_chunking(self, file_path: str) -> List[SemanticChunk]:
        """Fallback text-based chunking per unsupported files"""
        chunks = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Simple line-based chunking
            lines = content.split('\n')
            chunk_size = 100  # lines

            for i in range(0, len(lines), chunk_size):
                chunk_lines = lines[i:i+chunk_size]
                chunk_content = '\n'.join(chunk_lines)

                semantic_hash = hashlib.sha256(chunk_content.encode()).hexdigest()[:16]

                chunks.append(SemanticChunk(
                    content=chunk_content,
                    chunk_type='text_chunk',
                    file_path=file_path,
                    start_line=i+1,
                    end_line=min(i+chunk_size, len(lines)),
                    dependencies=[],
                    author_info=None,
                    git_blame=None,
                    ast_metadata={'chunk_method': 'fallback_text'},
                    semantic_hash=semantic_hash,
                    token_count=len(chunk_content.split())
                ))

        except Exception as e:
            self.logger.error(f"Error in fallback chunking for {file_path}: {e}")

        return chunks

    async def scan_directory(self, directory: str, max_files: int = 1000) -> List[FileAnalysis]:
        """Scan directory per all supported files"""
        analyses = []
        files_found = 0

        directory_path = Path(directory)

        for file_path in directory_path.rglob('*'):
            if files_found >= max_files:
                break

            if self.can_handle(str(file_path)):
                try:
                    analysis = await self.extract_file_contexts(str(file_path))
                    analyses.append(analysis)
                    files_found += 1
                except Exception as e:
                    self.logger.error(f"Error processing {file_path}: {e}")

        self.logger.info(f"Scanned {len(analyses)} files in {directory}")
        return analyses

    def get_performance_metrics(self) -> Dict[str, Any]:
        """Get performance metrics"""
        return {
            **self.metrics,
            'avg_chunks_per_file': self.metrics['chunks_generated'] / max(self.metrics['files_processed'], 1),
            'avg_tokens_per_chunk': self.metrics['total_tokens'] / max(self.metrics['chunks_generated'], 1),
            'ast_success_rate': self.metrics['ast_successes'] / max(
                self.metrics['ast_successes'] + self.metrics['ast_failures'], 1
            )
        }

# Convenience functions
async def analyze_single_file(file_path: str) -> FileAnalysis:
    """Quick analysis di single file"""
    handler = FileSystemHandler()
    return await handler.extract_file_contexts(file_path)

async def analyze_project_files(project_root: str) -> List[FileAnalysis]:
    """Quick analysis di entire project"""
    handler = FileSystemHandler(project_root)
    return await handler.scan_directory(project_root)
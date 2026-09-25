"""Loads the YAML content from disk into validated models, collecting every error instead of
stopping at the first, so the validator can report all problems in one run."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from pydantic import ValidationError

from app.content.schema import Concept, Question

# The repo's content/ folder, unless QURIOUS_CONTENT_DIR points elsewhere (e.g. in a container).
DEFAULT_CONTENT_DIR = Path(
    os.environ.get("QURIOUS_CONTENT_DIR") or Path(__file__).resolve().parents[3] / "content"
)


@dataclass
class Content:
    concepts: dict[str, Concept] = field(default_factory=dict)
    questions: dict[str, Question] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)


def _load_folder(folder: Path, model, content: Content, into: dict) -> None:
    for path in sorted(folder.glob("*.yaml")):
        where = f"{folder.name}/{path.name}"
        try:
            data = yaml.safe_load(path.read_text())
            item = model.model_validate(data)
        except yaml.YAMLError as e:
            content.errors.append(f"{where}: invalid YAML: {e}")
            continue
        except ValidationError as e:
            for err in e.errors():
                loc = ".".join(str(part) for part in err["loc"]) or "(file)"
                content.errors.append(f"{where}: {loc}: {err['msg']}")
            continue
        if path.stem != item.id:
            content.errors.append(f"{where}: file name must match id '{item.id}'")
        if item.id in into:
            content.errors.append(f"{where}: duplicate id '{item.id}'")
        into[item.id] = item


def load_content(content_dir: Path = DEFAULT_CONTENT_DIR) -> Content:
    content = Content()
    _load_folder(content_dir / "concepts", Concept, content, content.concepts)
    _load_folder(content_dir / "questions", Question, content, content.questions)
    return content

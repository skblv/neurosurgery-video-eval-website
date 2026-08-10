"""Dataset ontologies, S3 layout, and the deterministic validation-frame sample.

The instrument vocabularies and the sampling procedure are copied verbatim from
the published eval scripts (``s33``/``s37``/``s46``/``s51``/``s54``/``s55`` in
the ``neurosurgery-video`` repo) so leaderboard entries stay comparable to the
numbers in the paper.

The published scripts read frames from Pythia absolute paths. Those paths are
kept here because the seed-42 permutation is taken over the *sorted* frame list,
so reproducing the published sample requires reproducing the sort key. Every
frame in a dataset shares one root prefix, so sorting the absolute paths and
sorting the S3 keys give the same order; the absolute form is retained to make
that equivalence obvious rather than implicit.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path, PurePosixPath

import pandas as pd

from runner.config import RANDOM_SEED, S3_DATASETS_PREFIX

# -------------------------------------------------------------- ontologies

CHOLECT50_INSTRUMENTS = [
    "grasper", "bipolar", "hook",
    "scissors", "clipper", "irrigator",
]

PITVIS_INSTRUMENTS = [
    "bipolar_forceps", "cottle", "cup_forceps", "dural_scissors",
    "freer_elevator", "haemostatic_foam", "irrigation_syringe",
    "kerrisons", "micro_doppler", "nasal_cutting_forceps",
    "pituitary_rongeurs", "retractable_knife", "ring_curette",
    "spatula_dissector", "stealth_pointer", "suction",
    "surgical_drill", "tissue_glue",
]

SURGVU_INSTRUMENTS = [
    "bipolar dissector", "bipolar forceps", "cadiere forceps",
    "clip applier", "force bipolar", "grasping retractor",
    "monopolar curved scissors", "needle driver",
    "permanent cautery hook/spatula", "potts scissors",
    "prograsp forceps", "stapler", "suction irrigator",
    "synchroseal", "tenaculum forceps",
    "tip-up fenestrated grasper", "vessel sealer",
]

# ------------------------------------------------------------------ config


@dataclass(frozen=True)
class DatasetConfig:
    """Everything needed to evaluate one benchmark dataset from S3.

    Attributes:
        key: Short dataset identifier used in job specs and output paths.
        display_name: Name shown to submitters in status notifications.
        website_id: Matching dataset id in the public site's results.json.
        s3_dir: Directory name under ``datasets/`` in the bucket.
        manifest_key: S3 key of the dataset.csv manifest.
        old_root: Stale path prefix inside dataset.csv, or None.
        new_root: Prefix that replaces old_root, and the root the frame paths
            are made relative to when deriving S3 keys.
        instrument_names: Valid tool classes for the prompt and for scoring.
    """

    key: str
    display_name: str
    website_id: str
    s3_dir: str
    manifest_key: str
    old_root: str | None
    new_root: str
    instrument_names: list[str]

    def s3_key_for_frame(self, frame_path: str) -> str:
        """Translate a manifest frame path into its S3 object key.

        Args:
            frame_path: Frame path from dataset.csv, already root-rewritten.

        Returns:
            The key of that frame inside the eval bucket.

        Raises:
            ValueError: If the frame path does not sit under ``new_root``.
        """
        relative = PurePosixPath(frame_path).relative_to(self.new_root)
        return f"{S3_DATASETS_PREFIX}/{self.s3_dir}/{relative}"


DATASET_CONFIGS: dict[str, DatasetConfig] = {
    "cholect50": DatasetConfig(
        key="cholect50",
        display_name="CholecT50",
        website_id="cholect50",
        s3_dir="cholect50",
        manifest_key=f"{S3_DATASETS_PREFIX}/cholect50/dataset.csv",
        old_root="/project_gpfs/caai/shared/CholecT50",
        new_root="/project_gpfs/xyhan/SDSC/surgvu/CholecT50",
        instrument_names=CHOLECT50_INSTRUMENTS,
    ),
    "pitvis": DatasetConfig(
        key="pitvis",
        display_name="PitVis-2023",
        website_id="pitvis",
        s3_dir="pitvis2023",
        manifest_key=f"{S3_DATASETS_PREFIX}/pitvis2023/dataset.csv",
        old_root="/project_gpfs/caai/shared/PitVis2023",
        new_root="/project_gpfs/xyhan/SDSC/surgvu/PitVis2023",
        instrument_names=PITVIS_INSTRUMENTS,
    ),
    "surgvu": DatasetConfig(
        key="surgvu",
        display_name="SurgVU",
        website_id="surgvu",
        s3_dir="surgvu",
        manifest_key=f"{S3_DATASETS_PREFIX}/surgvu/dataset.csv",
        old_root=None,
        new_root="/project_gpfs/xyhan/SDSC/surgvu/SurgVU",
        instrument_names=SURGVU_INSTRUMENTS,
    ),
}

DATASET_KEYS = list(DATASET_CONFIGS.keys())

# ------------------------------------------------------------ frame sampling


@dataclass(frozen=True)
class EvalFrame:
    """One validation frame to score.

    Attributes:
        frame_id: Stable identifier, equal to the manifest frame path. Used as
            the cache key and as the ``frame_path`` column in results.csv so
            output stays comparable with the published runs.
        s3_key: Object key to stream the image bytes from.
        ground_truth_tools: Instrument names present in the frame.
    """

    frame_id: str
    s3_key: str
    ground_truth_tools: list[str]


def load_manifest(config: DatasetConfig, manifest_bytes: bytes) -> pd.DataFrame:
    """Parse a dataset manifest and normalise its frame paths.

    Args:
        config: Dataset configuration.
        manifest_bytes: Raw bytes of dataset.csv as stored in S3.

    Returns:
        A frame-level dataframe with ``frame_path``, ``split`` and
        ``truth_label`` columns.

    Raises:
        ValueError: If a required column is missing.
    """
    frame_label_df = pd.read_csv(BytesIO(manifest_bytes))

    required_columns = {"frame_path", "split", "truth_label"}
    missing = required_columns - set(frame_label_df.columns)
    if missing:
        raise ValueError(
            f"{config.key}: manifest {config.manifest_key} is missing "
            f"columns {sorted(missing)}"
        )

    if config.old_root is not None:
        frame_label_df["frame_path"] = frame_label_df["frame_path"].str.replace(
            config.old_root, config.new_root, regex=False,
        )

    return frame_label_df


def select_eval_frames(
    config: DatasetConfig,
    frame_label_df: pd.DataFrame,
    n_obs: int | None,
) -> list[EvalFrame]:
    """Pick the validation frames to score, reproducing the published sample.

    The published scripts sort every validation frame path, take the seed-42
    permutation of that list, then keep the first ``n_obs``. Reproducing all
    three steps is what makes a new leaderboard entry comparable to the numbers
    already on the site, so the procedure is kept byte-for-byte identical.

    Args:
        config: Dataset configuration.
        frame_label_df: Manifest as returned by :func:`load_manifest`.
        n_obs: Number of frames to keep, or None for the whole validation split.

    Returns:
        The selected frames, in the published order.

    Raises:
        ValueError: If the validation split is empty or smaller than ``n_obs``.
    """
    frame_to_label = {
        row["frame_path"]: json.loads(row["truth_label"])
        for _, row in frame_label_df.iterrows()
    }

    val_mask = frame_label_df["split"] == "val"
    all_val_frames = sorted(
        Path(p) for p in frame_label_df[val_mask]["frame_path"].tolist()
    )
    if not all_val_frames:
        raise ValueError(f"{config.key}: manifest contains no rows with split == 'val'")

    random.seed(RANDOM_SEED)
    shuffled_frames = random.sample(all_val_frames, len(all_val_frames))

    if n_obs is None:
        sampled_frames = shuffled_frames
    else:
        if n_obs > len(shuffled_frames):
            raise ValueError(
                f"{config.key}: requested {n_obs} frames but the validation "
                f"split only has {len(shuffled_frames)}"
            )
        sampled_frames = shuffled_frames[:n_obs]

    return [
        EvalFrame(
            frame_id=str(frame_path),
            s3_key=config.s3_key_for_frame(str(frame_path)),
            ground_truth_tools=frame_to_label[str(frame_path)],
        )
        for frame_path in sampled_frames
    ]

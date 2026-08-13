#!/bin/bash
#SBATCH --job-name=hQ7vnKp
#SBATCH --account=pi-kilianhuber
#SBATCH --partition=standard_l40s
#SBATCH --cpus-per-task=8
#SBATCH --mem=8G
#SBATCH --time=20:00:00
#SBATCH --output=/project/xyhan/SDSC/outputs/s60_s3_ingest/slurm_%j.out
#SBATCH --error=/project/xyhan/SDSC/outputs/s60_s3_ingest/slurm_%j.err

# Uploads the three PUBLIC surgical datasets to S3 for the leaderboard eval runner.
# The private SDSC-EEA data under /project/xyhan/SDSC/videos is deliberately never
# referenced here. Uploads are unsigned: the destination bucket policy grants
# write-only PutObject to the UChicago egress IPs, so no AWS credentials are needed
# and the transfer cannot die from an expiring SSO token.

set -uo pipefail

BUCKET="s3://caai-surgical-eval/datasets"
REGION="us-east-2"
SRC_ROOT="/project_gpfs/xyhan/SDSC/surgvu"
LOG_DIR="/project/xyhan/SDSC/outputs/s60_s3_ingest"
AWS="$HOME/.local/bin/aws"
MAX_ATTEMPTS=5

mkdir -p "$LOG_DIR"

# High-concurrency transfer profile; kept in the job's temp dir so it never
# perturbs the user's normal AWS config.
TEMP_DIR="/hpc_temp/$USER/${SLURM_JOB_ID:-manual}"
mkdir -p "$TEMP_DIR"
export AWS_CONFIG_FILE="$TEMP_DIR/aws_config"
cat > "$AWS_CONFIG_FILE" <<'CFG'
[default]
s3 =
    max_concurrent_requests = 64
    max_queue_size = 10000
    multipart_threshold = 64MB
    multipart_chunksize = 32MB
CFG

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

# dataset_name:source_subdir
DATASETS=(
  "cholect50:CholecT50"
  "pitvis2023:PitVis2023"
  "surgvu:SurgVU"
)

log "job=${SLURM_JOB_ID:-manual} node=$(hostname) egress=$(curl -s --max-time 10 https://checkip.amazonaws.com)"
log "destination=$BUCKET"

overall_status=0

for entry in "${DATASETS[@]}"; do
  name="${entry%%:*}"
  subdir="${entry##*:}"
  src="$SRC_ROOT/$subdir"

  if [ ! -d "$src" ]; then
    log "FATAL: source missing: $src"
    overall_status=1
    continue
  fi

  log "=== $name: syncing $src -> $BUCKET/$name/"
  attempt=1
  synced=0
  while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
    log "$name: attempt $attempt/$MAX_ATTEMPTS"
    "$AWS" s3 sync "$src/" "$BUCKET/$name/" \
      --region "$REGION" \
      --no-sign-request \
      --only-show-errors \
      --no-progress
    rc=$?
    if [ "$rc" -eq 0 ]; then
      log "$name: sync completed on attempt $attempt"
      synced=1
      break
    fi
    log "$name: attempt $attempt failed with exit code $rc; retrying in 60s"
    attempt=$((attempt + 1))
    sleep 60
  done

  if [ "$synced" -ne 1 ]; then
    log "FATAL: $name failed after $MAX_ATTEMPTS attempts"
    overall_status=1
    continue
  fi

  local_files=$(find "$src" -type f | wc -l)
  remote_files=$("$AWS" s3 ls "$BUCKET/$name/" --recursive --region "$REGION" --no-sign-request | wc -l)
  log "$name: local_files=$local_files remote_objects=$remote_files"
  if [ "$local_files" -ne "$remote_files" ]; then
    log "WARNING: $name object count mismatch (local=$local_files remote=$remote_files)"
    overall_status=1
  fi
done

rm -rf "$TEMP_DIR"

if [ "$overall_status" -eq 0 ]; then
  log "ALL DATASETS UPLOADED SUCCESSFULLY"
else
  log "FINISHED WITH ERRORS (see above)"
fi
exit "$overall_status"

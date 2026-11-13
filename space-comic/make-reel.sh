#!/bin/bash
# Build a 1080x1920 Reel from an episode's rendered slides.
# Usage: ./make-reel.sh episodes/01-the-last-photograph
set -e
dir="$1"; tmp=$(mktemp -d); : > "$tmp/list.txt"
for f in "$dir"/slides/slide-*.png; do
  n=$(basename "$f" .png)
  ffmpeg -loglevel error -y -loop 1 -t 4.5 -i "$f" -filter_complex "[0]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.25[bg];[b]scale=2160:-1,zoompan=z='1+0.05*on/135':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1350:fps=30[fg];[bg][fg]overlay=0:285,fade=in:0:8,fade=out:st=4.2:d=0.3,format=yuv420p" -r 30 -c:v libx264 -crf 20 "$tmp/$n.mp4"
  echo "file '$tmp/$n.mp4'" >> "$tmp/list.txt"
done
ffmpeg -loglevel error -y -f concat -safe 0 -i "$tmp/list.txt" -c copy "$dir/reel.mp4"
rm -rf "$tmp"; echo "$dir/reel.mp4"

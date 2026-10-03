// Controls the Music app on this Mac with AppleScript, for the record player and
// the play / previous / next strip by the greeting. Only fixed scripts run here;
// a playlist name is passed as an argument, never pasted into the script.
import { execFile } from "node:child_process";

const run = (script, args = []) =>
  new Promise((resolve, reject) => {
    execFile("osascript", ["-e", script, ...args], { timeout: 8000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout.trim());
    });
  });

export const musicAvailable = process.platform === "darwin";

// Doesn't open Music just to ask: if it isn't running, the answer is "off".
const STATUS = `
if application "Music" is not running then return "off"
tell application "Music"
  set s to player state as text
  if s is "stopped" then return s
  set out to s & tab & (name of current track) & tab & (artist of current track)
  try
    set out to out & tab & (name of current playlist)
  end try
  return out
end tell`;

export async function musicStatus() {
  if (!musicAvailable) return { available: false };
  try {
    const [state, track = null, artist = null, playlist = null] = (await run(STATUS)).split("\t");
    return { available: true, state, track, artist, playlist };
  } catch (err) {
    // Usually: macOS hasn't been allowed to let Hanua control Music yet.
    return { available: true, state: "unknown", error: err.message };
  }
}

const ACTIONS = {
  playpause: 'tell application "Music" to playpause',
  pause: 'tell application "Music" to pause',
  next: 'tell application "Music" to next track',
  previous: 'tell application "Music" to previous track',
};

export async function musicAction(action) {
  if (!ACTIONS[action]) throw new Error(`Unknown music action: ${action}`);
  await run(ACTIONS[action]);
  return musicStatus();
}

const PLAY_PLAYLIST = `
on run argv
  tell application "Music"
    play playlist (item 1 of argv)
  end tell
end run`;

// Plays a playlist from your library by name. If it isn't in your library,
// opens its Apple Music page in the Music app instead, so you can press play there.
export async function playPlaylist(name, url) {
  try {
    await run(PLAY_PLAYLIST, [name]);
    return { via: "library", ...(await musicStatus()) };
  } catch {
    if (!/^https:\/\/music\.apple\.com\//.test(url || "")) throw new Error(`"${name}" isn't in your Music library.`);
    await new Promise((resolve, reject) =>
      execFile("open", [url.replace(/^https:/, "music:")], (err) => (err ? reject(err) : resolve())));
    return { via: "opened", ...(await musicStatus()) };
  }
}

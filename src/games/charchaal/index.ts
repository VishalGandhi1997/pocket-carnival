// Char Ki Chaal — four-in-a-row disc drop. Generic grid-drop mechanic
// (public domain rules; original board art/colors, not Hasbro trade dress).
import { createGameCanvas, palette, roundRect } from "../../engine/canvas";
import { makeTurnBanner, showOverlay } from "../../engine/ui";
import type { Sdk } from "../../sdk/platform";

const COLS = 7;
const ROWS = 6;
type Cell = 0 | 1 | 2;

export function mountCharKiChaal(host: HTMLElement, sdk: Sdk, opts?: { mode?: "bot" | "pnp" }): () => void {
  const mode = opts?.mode ?? "bot";
  const banner = makeTurnBanner(host);
  // Extra top space (vs 0.12) makes room for the drop-arrow band so it's clear
  // you pick a COLUMN and the disc falls in from the top.
  const gc = createGameCanvas(host, ROWS / COLS + 0.3);
  const { ctx } = gc;

  let board: Cell[][] = [];
  let turn: 1 | 2 = 1;
  let over = false;
  let hoverCol = -1;
  let winLine: [number, number][] | null = null;
  let dropAnim: { col: number; row: number; player: Cell; t: number } | null = null;

  function reset() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0) as Cell[]);
    turn = 1;
    over = false;
    winLine = null;
    dropAnim = null;
    refreshBanner();
  }

  function refreshBanner() {
    if (over) return;
    if (turn === 1) banner.set("Your turn — drop a disc", "you");
    else banner.set(mode === "bot" ? "🤖 Bot is thinking…" : "Player 2's turn", "opp");
  }

  function lowestRow(col: number): number {
    for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
    return -1;
  }

  function checkWin(b: Cell[][], player: Cell): [number, number][] | null {
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] !== player) continue;
        for (const [dr, dc] of dirs) {
          const line: [number, number][] = [[r, c]];
          for (let k = 1; k < 4; k++) {
            const rr = r + dr * k, cc = c + dc * k;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || b[rr][cc] !== player) break;
            line.push([rr, cc]);
          }
          if (line.length === 4) return line;
        }
      }
    return null;
  }

  function drop(col: number, player: Cell) {
    const row = lowestRow(col);
    if (row < 0) return false;
    dropAnim = { col, row, player, t: 0 };
    board[row][col] = player;
    sdk.haptic();
    return true;
  }

  function afterDrop(player: Cell) {
    const win = checkWin(board, player);
    if (win) {
      winLine = win;
      return endGame(player);
    }
    if (board.every((row) => row.every((c) => c !== 0))) return endGame(0);
    turn = player === 1 ? 2 : 1;
    refreshBanner();
    if (mode === "bot" && turn === 2 && !over) setTimeout(botMove, 550);
  }

  function botMove() {
    if (over) return;
    const valid = [...Array(COLS).keys()].filter((c) => lowestRow(c) >= 0);
    // 1) win now
    for (const c of valid) if (simWin(c, 2)) return drop(c, 2);
    // 2) block human win
    for (const c of valid) if (simWin(c, 1)) return drop(c, 2);
    // 3) prefer center columns with slight randomness
    const weighted = valid
      .map((c) => ({ c, w: 4 - Math.abs(c - 3) + Math.random() }))
      .sort((a, b) => b.w - a.w);
    drop(weighted[0].c, 2);
  }

  function simWin(col: number, player: Cell): boolean {
    const row = lowestRow(col);
    if (row < 0) return false;
    board[row][col] = player;
    const win = !!checkWin(board, player);
    board[row][col] = 0;
    return win;
  }

  function endGame(winner: Cell) {
    over = true;
    const youWon = winner === 1;
    const coins = youWon ? 25 : winner === 0 ? 8 : 5;
    if (youWon) sdk.submitScore("charchaal", sdk.getBest("charchaal") + 1);
    sdk.addCoins(coins, "Char Ki Chaal");
    banner.set(youWon ? "🏆 You Won!" : winner === 0 ? "Board Full — Draw" : `${mode === "bot" ? "Bot" : "Player 2"} Won`, youWon ? "you" : "opp");
    showOverlay(gc.canvas, {
      title: youWon ? "Four in a Row! 🏆" : winner === 0 ? "It's a Draw" : "You Lost",
      coins,
      mood: youWon ? "win" : "lose",
      primaryLabel: "Play Again",
      onPrimary: reset,
    });
  }

  function colFromX(x: number, pad: number, cell: number) {
    return Math.floor((x - pad) / cell);
  }

  const myTurn = () => !over && !dropAnim && !(mode === "bot" && turn !== 1);

  gc.onMove((p) => {
    const { pad, cell } = layout();
    if (myTurn()) hoverCol = colFromX(p.x, pad, cell);
  });
  gc.onDown((p) => {
    if (!myTurn()) return;
    const { pad, cell } = layout();
    const col = colFromX(p.x, pad, cell);
    if (col < 0 || col >= COLS) return;
    hoverCol = col; // light up the picked column (matters on touch — no hover)
    drop(col, turn);
  });
  gc.onUp(() => {
    hoverCol = -1;
  });

  function layout() {
    const pad = 10;
    const cell = (gc.w - pad * 2) / COLS;
    const boardTop = cell * 0.95; // top band reserved for the drop arrows
    return { pad, cell, boardTop };
  }

  gc.run((dt) => {
    if (dropAnim) {
      dropAnim.t += dt * 3.6; // a touch slower so the fall is clearly visible
      if (dropAnim.t >= 1) {
        const p = dropAnim.player;
        dropAnim = null;
        afterDrop(p);
      }
    }
    ctx.clearRect(0, 0, gc.w, gc.h);
    roundRect(ctx, 0, 0, gc.w, gc.h, 18, palette.bg);
    const { pad, cell, boardTop } = layout();
    const activeCol = hoverCol >= 0 && hoverCol < COLS ? hoverCol : dropAnim?.col ?? -1;
    const discColor = turn === 1 ? palette.teal : palette.pink;

    // full-height highlight of the picked column
    if (myTurn() && activeCol >= 0) {
      roundRect(ctx, pad + activeCol * cell, boardTop - 2, cell, ROWS * cell + 12, 10, "rgba(255,255,255,0.12)");
    }

    // drop-arrow band above every column (the "you drop from the top" cue)
    for (let c = 0; c < COLS; c++) {
      const cx = pad + c * cell + cell / 2;
      const isActive = c === activeCol && myTurn();
      if (isActive) {
        // ghost disc in your colour sitting at the top, ready to fall
        ctx.globalAlpha = 0.5;
        drawDisc(cx, boardTop - cell * 0.5, cell, turn);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = isActive ? discColor : "rgba(255,248,236,0.28)";
      const ay = boardTop - cell * 0.16;
      const aw = cell * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx - aw, ay - aw);
      ctx.lineTo(cx + aw, ay - aw);
      ctx.lineTo(cx, ay + aw);
      ctx.closePath();
      ctx.fill();
    }

    // board plate
    roundRect(ctx, pad - 4, boardTop - 4, COLS * cell + 8, ROWS * cell + 8, 14, "#3a2a7a");

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const cx = pad + c * cell + cell / 2;
        let cy = boardTop + r * cell + cell / 2;
        const v = board[r][c];
        if (dropAnim && dropAnim.col === c && dropAnim.row === r) {
          const fall = easeBounce(dropAnim.t);
          const startY = boardTop - cell * 0.5; // falls in from the arrow band
          const endY = boardTop + r * cell + cell / 2;
          cy = startY + (endY - startY) * fall;
          drawDisc(cx, cy, cell, dropAnim.player);
          continue;
        }
        drawDisc(cx, cy, cell, v);
      }

    // win line highlight
    if (winLine) {
      ctx.strokeStyle = palette.marigold;
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      const [r0, c0] = winLine[0];
      const [r1, c1] = winLine[winLine.length - 1];
      ctx.beginPath();
      ctx.moveTo(pad + c0 * cell + cell / 2, boardTop + r0 * cell + cell / 2);
      ctx.lineTo(pad + c1 * cell + cell / 2, boardTop + r1 * cell + cell / 2);
      ctx.stroke();
    }
  });

  function drawDisc(cx: number, cy: number, cell: number, player: Cell) {
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.38, 0, 7);
    ctx.fillStyle = player === 0 ? "#241a52" : player === 1 ? palette.teal : palette.pink;
    ctx.fill();
    if (player !== 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function easeBounce(t: number) {
    const c = Math.min(1, t);
    return 1 - Math.pow(1 - c, 3);
  }

  reset();
  return () => gc.destroy();
}

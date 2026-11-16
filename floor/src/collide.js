/* Collision is done in plan: the player is a circle, everything solid is a
   rectangle that may be turned at an angle, and a blocked move slides along
   whichever wall it hit instead of stopping dead. That is enough for a room
   you walk around in, and it costs nothing. */
export class Solids {
  constructor() { this.rects = []; }
  /* cx, cz centre; hw, hd half extents; rot radians about Y */
  add(cx, cz, hw, hd, rot = 0, tag = '') {
    this.rects.push({ cx, cz, hw, hd, c: Math.cos(-rot), s: Math.sin(-rot), tag });
    return this;
  }
  /* the four walls, as rectangles facing inward */
  addRoom(w, d, t = 1) {
    this.add(0, -d / 2 - t / 2 + 0.35, w / 2, t / 2);
    this.add(0, d / 2 + t / 2 - 0.35, w / 2, t / 2);
    this.add(-w / 2 - t / 2 + 0.35, 0, t / 2, d / 2);
    this.add(w / 2 + t / 2 - 0.35, 0, t / 2, d / 2);
    return this;
  }
  /* Push a point out of every rectangle it has got inside of. Running the
     resolve twice settles corners, where one push can shove you into the
     neighbour. */
  resolve(x, z, r) {
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < this.rects.length; i++) {
        const o = this.rects[i];
        /* into the rectangle's own frame */
        const dx = x - o.cx, dz = z - o.cz;
        const lx = dx * o.c - dz * o.s;
        const lz = dx * o.s + dz * o.c;
        const px = Math.max(-o.hw, Math.min(o.hw, lx));
        const pz = Math.max(-o.hd, Math.min(o.hd, lz));
        let ox = lx - px, oz = lz - pz;
        let dist = Math.hypot(ox, oz);
        if (dist > r) continue;
        if (dist < 1e-6) {
          /* Properly inside it, which is where you end up if something was
             built around you. Step out through the nearest face and stop
             there, rather than scaling a direction by (r - dist): at dist 0
             that factor is negative and drives you further in. */
          const left = o.hw + lx, right = o.hw - lx, back = o.hd + lz, front = o.hd - lz;
          const m = Math.min(left, right, back, front);
          let elx = lx, elz = lz;
          if (m === left) elx = -o.hw - r;
          else if (m === right) elx = o.hw + r;
          else if (m === back) elz = -o.hd - r;
          else elz = o.hd + r;
          x = o.cx + elx * o.c + elz * o.s;
          z = o.cz - elx * o.s + elz * o.c;
          continue;
        }
        const push = (r - dist) / dist;
        const nlx = lx + ox * push, nlz = lz + oz * push;
        /* back out to world */
        x = o.cx + nlx * o.c + nlz * o.s;
        z = o.cz - nlx * o.s + nlz * o.c;
      }
    }
    return [x, z];
  }
}

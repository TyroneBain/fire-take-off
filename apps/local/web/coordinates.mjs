// CSS viewport coordinates -> immutable native PDF coordinates (not canvas pixels).
export function pagePoint(viewport, rectangle, clientX, clientY) {
  if (!(rectangle.width > 0 && rectangle.height > 0)) throw new RangeError('Page is not visible');
  return viewport.convertToPdfPoint(
    (clientX - rectangle.left) * viewport.width / rectangle.width,
    (clientY - rectangle.top) * viewport.height / rectangle.height,
  );
}
export function viewPoint(viewport, x, y) { return viewport.convertToViewportPoint(x,y); }
export function clientPoint(viewport,rectangle,x,y) {
  const [vx,vy]=viewPoint(viewport,x,y);
  return [rectangle.left+vx*rectangle.width/viewport.width,rectangle.top+vy*rectangle.height/viewport.height];
}

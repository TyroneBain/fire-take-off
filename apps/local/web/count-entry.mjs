// Neutral names keep drawing selection immediate without claiming smart naming.
export function nextSymbolName(items) {
  const names=new Set(items.map(item=>item.name.trim().toLocaleLowerCase()));
  let number=1;
  while(names.has(`symbol ${number}`))number++;
  return `Symbol ${number}`;
}

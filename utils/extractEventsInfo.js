
// EXPORT MODULE TO BUILD ARRAY OF EVENTS INFO
module.exports = events => {
  const array = [];
  events.map((item) => {
    const itemArray = item.split("  ");
    itemArray.length > 1 && itemArray[0].length === 10
      ? array.push({
        date: itemArray[0],
        name: itemArray[1].trim(),
      })
      : null;
  });
  return array;
};
// EXPORT MODULE TO BUILD ARRAY FOR EACH PARTY USING PARTY ORDER ARRAY
module.exports = (partyInfo, tags) => {
  const arrays = {
    plaintiff: null,
    defendant1: null,
    defendant2: null
  };
  

  // GET ARRAY OF PARTY TYPE AND INDEX
  const partyOrderArray = []
  
  partyInfo.forEach((item, i) =>
  item === tags.parties.plaintiff ? partyOrderArray.push({party: item, index: i})
    : item === tags.parties.defendant ? partyOrderArray.push({party: item, index: i})
      : tags.parties.other.includes(item) ? partyOrderArray.push({party: item, index: i})
          : null
  );
  
  // LOOP OVER ARRAY OF PARTY POSITION OBJECTS TO GET ARRAY OF PARTY INFO
  partyOrderArray.forEach((item, i) => {
    const lastItem = i === partyOrderArray.length - 1;
    const nextItemIndex = !lastItem ? partyOrderArray[i + 1].index : null;
    const array = !lastItem ?  partyInfo.slice(item.index + 1, nextItemIndex) : 
      partyInfo.slice(item.index + 1);
    
    item.party === tags.parties.plaintiff &&
    !arrays.plaintiff ?
        arrays.plaintiff = array
    : item.party === tags.parties.defendant &&
      !arrays.defendant1 ?
        arrays.defendant1 = array
      : item.party === tags.parties.defendant ?
        arrays.defendant2 = array
    : null

  });

  return arrays;
};
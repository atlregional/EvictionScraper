// EXPORT MODULE TO EXTRACT PARTY INFO
module.exports = (thisPartyInfo, tags) => {
  const name = thisPartyInfo ? thisPartyInfo[0] : '';
  const addressIndex = thisPartyInfo.includes(tags.address) ? 
    thisPartyInfo.indexOf(tags.address)
  : null;
  const attorneyIndex = thisPartyInfo.includes(tags.attorney) ? 
    thisPartyInfo.indexOf(tags.attorney)
  : null;
  const attorney = attorneyIndex ? thisPartyInfo.slice(attorneyIndex + 1).filter(item => item.search('Attorney') === -1 ).join(',') : '';
  const address = addressIndex && attorneyIndex ? 
    {
      street: thisPartyInfo.slice(addressIndex + 1, attorneyIndex - 1).join(','),
      city: thisPartyInfo.slice(attorneyIndex - 1, attorneyIndex)[0]
    }
    : addressIndex ?
      {
        street: thisPartyInfo.slice(addressIndex + 1, thisPartyInfo.length - 1).join(','),
        city: thisPartyInfo[thisPartyInfo.length - 1]
      }
      : null;
        
  return { 
    address: address ? address.street : '', 
    city: address ? address.city : '', 
    attorney: attorney, 
    name: name
  };
};
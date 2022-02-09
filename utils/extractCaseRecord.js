// IMPORT UTILITY MODULES
const divToArray = require('./divToArray');
const getPartyArrays = require('./getPartyArrays');
const extractPartyInfo = require('./extractPartyInfo');
const extractEventsInfo = require('./extractEventsInfo');

// EXPORT MODULE TO EXTRACT CASE RECORD INFORMATION FROM HTML
module.exports = (html, config) => {

  // CONFIGS
  const divIDs = config.divIDs;
  const tags = config.tags;

  // EXTRACT HTML TO ARRAYS
  const caseInfo = divToArray(html, divIDs.caseInfo);
  const partyInfo = divToArray(html, divIDs.partyInfo);
  const dispositionEvents = divToArray(html, divIDs.dispositionEvents).reverse();
  const events = divToArray(html, divIDs.events);
  
  // SET EMPTY OBJECT TO HANDLE NULL VALUES
  const emptyObj = {
    name: '',
    address: '',
    city: '',
    attorney: '',
    phone: '' 
  };

  // EXTRACT PARTY INFO TO ARRAYS
  const partyArrays = getPartyArrays(partyInfo, tags);

  // BUILD PARTIES OBJECT
  const parties = {
    plaintiff: partyArrays.plaintiff ?
      { 
        ...emptyObj,
        ...extractPartyInfo(partyArrays.plaintiff, tags)
      }
      : emptyObj,
    defendant1: partyArrays.defendant1 ?
      {
        ...emptyObj,
        ...extractPartyInfo(partyArrays.defendant1, tags)
      }
      : emptyObj,
    defendant2: partyArrays.defendant2 ?
      {
        ...emptyObj,
        ...extractPartyInfo(partyArrays.defendant2, tags)
      }
      : emptyObj
  };

  // EXTRACT JUDGMENT INFO
  const judgmentType = 
    dispositionEvents ?
      dispositionEvents.includes('Judgment Type') ?
        dispositionEvents[dispositionEvents.indexOf('Judgment Type') - 1]
      : ''
    : '';

  const judgmentFor = 
    dispositionEvents ?
      dispositionEvents.includes('Award') ?
        dispositionEvents[dispositionEvents.indexOf('Award') - 1].replace('Judgment For: ', '')
      : ''
    : '';
  
  const judgmentComp =
    dispositionEvents ?
      dispositionEvents.includes('Compensatory:') ?
        dispositionEvents[dispositionEvents.indexOf('Compensatory:') - 1].replace('Judgment For: ', '')
      : ''
    : '';
  
  // COMPILE CASE RECORD
  const caseRecordObj = {
    fileDate: caseInfo[caseInfo.indexOf(tags.fileDate) + 1],
    caseID: caseInfo[caseInfo.indexOf(tags.caseID) + 1],
    plaintiff: parties.plaintiff.name,
    plaintiffAddress: parties.plaintiff.address,
    plaintiffCity: parties.plaintiff.city,
    plaintiffPhone: parties.plaintiff.phone,
    plaintiffAttorney: parties.plaintiff.attorney,
    defendantName1: parties.defendant1.name,
    defendantAddress1: parties.defendant1.address,
    defendantCity1: parties.defendant1.city,
    defendantPhone1: parties.defendant1.phone,
    defendantAttorney1: parties.defendant1.attorney,
    defendantName2: parties.defendant2.name,
    defendantAddress2: parties.defendant2.address,
    defendantCity2: parties.defendant2.city,
    defendantPhone2: parties.defendant2.phone,
    defendantAttorney2: parties.defendant2.attorney,
    caseStatus: caseInfo[caseInfo.indexOf(tags.caseStatus) + 1],
    address: `${parties.defendant1.address}, ${parties.defendant1.city}`,
    judgmentType: judgmentType,
    judgmentFor: judgmentFor,
    judgmentComp: judgmentComp,
    events: extractEventsInfo(events),
  };

  return caseRecordObj;
};
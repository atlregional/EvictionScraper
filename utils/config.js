// IMPORT CUSTOMIZATION CONFIGS
const configs = require('../config.json');

// EXPORT MODULE TO COMPILE COUNTY CONFIG OBJECT
module.exports = () => {
  const fields = [...configs.Global.fields];

  const globalConfig = {
    ...configs.Global,
    fields: fields,
    fresh: process.argv[2] === '-fresh',
    onlynew: process.argv[2] === '-onlynew'
  };

  const odysseyConfigs = {
    divIDs: {
      caseInfo: 'divCaseInformation_body',
      partyInfo: 'partyInformationDiv',
      events: 'eventsInformationDiv',
      dispositionEvents: 'dispositionInformationDiv',
    },
    tags: {
      fileDate: 'File Date',
      caseID: 'Case Number',
      address: 'Address',
      attorney: 'Active Attorneys',
      caseStatus: 'Case Status'
    },
    odyssey : true
  };
  
  const countyConfigs = {
    'Clayton': {
      ...globalConfig,
      ...configs.Clayton
    },
    'Maconbibb': {
      ...globalConfig,
      ...configs.Maconbibb
    },
    'Henry': {
      ...globalConfig,
      ...configs.Henry
    },
    'Cobb': {
      ...globalConfig,
      ...configs.Cobb
    },
    'Gwinnett': {
      ...globalConfig,
      ...configs.Gwinnett,
      ...odysseyConfigs,
      name: 'Gwinnett',
      odyssey: true,
      closedcasesterm:'Dis',
      dispossessoryterm: 'Dispossessory',
      nomatchterm: 'No cases match',
      starturl: 'https://odyssey.gwinnettcourts.com/Portal/',
      loginpath: '/Portal/Account/Login',
      searchpath: '/Portal/Home/Dashboard/29',
      tags: {
        ...odysseyConfigs.tags,
        parties: {
          plaintiff: 'Plaintiff',
          defendant: 'Defendant',
          other: []
        }
      },
      casenumbersliceindex : 5,
      caseID: caseNumber => 
      `${configs.Gwinnett.year ? configs.Gwinnett.year.toString().slice(2) : configs.Global.year.toString().slice(2)}-M-${caseNumber.toString().padStart(5, '0')}`

    },
    'Fulton': {
      ...globalConfig,
      ...configs.Fulton,
      ...odysseyConfigs,
      name: 'Fulton',
      closedcasesterm:'CLOSE',
      // starturl: 'https://publicrecordsaccess.fultoncountyga.gov/Portal/Home/Dashboard/29',
      starturl: 'https://publicrecordsaccess.fultoncountyga.gov/Portal/',
      loginpath: '/Portal/Account/Login',
      searchpath: '/Portal/Home/Dashboard/29',
      tags: {
        ...odysseyConfigs.tags,
        parties: {
          plaintiff: 'Plaintiff - Magistrate Court',
          defendant: 'Defendant - Magistrate Court',
          other: ['Agent']
        }
      },
      casenumbersliceindex : 4,
      caseID: caseNumber => 
        `${configs.Fulton.year ? configs.Fulton.year.toString().slice(2) : configs.Global.year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`

    },
    'DeKalb': {
      ...globalConfig,
      ...configs.DeKalb,
      ...odysseyConfigs,
      name: 'DeKalb',
      closedcasesterm:'Closed',
      starturl: 'https://ody.dekalbcountyga.gov/portal/',
      loginpath: '/portal/Account/Login',
      searchpath: '/portal/Home/Dashboard/29',
      tags: {
        ...odysseyConfigs.tags,
        parties: {
          plaintiff: 'Plaintiff',
          defendant: 'Defendant',
          other: ['Agent']
        }
      },
      casenumbersliceindex : 3,
      caseID: caseNumber => 
        `${configs.DeKalb.year ? configs.DeKalb.year.toString().slice(2) : configs.Global.year.toString().slice(2)}D${caseNumber.toString().padStart(5, '0')}`
    },
    'Chatham': {
      ...globalConfig,
      ...configs.Chatham,
      ...odysseyConfigs,
      name: 'Chatham',
      closedcasesterm:'Closed',
      dispossessoryterm: 'Dispossessory',
      starturl: 'https://cmsportal.chathamcounty.org/Portal/',
      loginpath: '/Portal/Account/Login',
      searchpath: '/Portal/Home/Dashboard/29',
      tags: {
        ...odysseyConfigs.tags,
        parties: {
          plaintiff: 'Plaintiff',
          defendant: 'Defendant',
          other: ['Agent']
        }
      },
      casenumbersliceindex : 7,
      caseID: caseNumber => 
        `MGCV${configs.DeKalb.year ? configs.DeKalb.year.toString().slice(2) : configs.Global.year.toString().slice(2)}-${caseNumber.toString().padStart(5, '0')}`
    }
  };
  
  return {...countyConfigs}
}
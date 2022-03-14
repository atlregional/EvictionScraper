const Nightmare = require('nightmare');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const initiate = require('../utils/initiate');
const caseEventsToCSV = require('../utils/caseEventsToCSV');
const { is } = require('cheerio/lib/api/traversing');

module.exports = config => {
  // INITIATE WEB DRIVER
  var nightmare = new Nightmare(
    {
      show: config.show,
      waitTimeout: config.timeout ? config.timeout : 20000
    }
  );

  // SET FILE LABEL VARIABLES
  const scrapeDate = moment().format('MM-DD-YYYY');
  const scrapeTimeStart = moment().format('h:mm A');

  // GET CONFIG INFO 
  const append = config.append; 
  const county = config.name;
  // const startURL = config.starturl;
  const dev = config.dev;
  const startCase = config.startcase || 1;
  var year = config.year || 2022;
  const fresh = config.fresh;
  const onlynew = config.onlynew;
  const fields = config.fields;
  const consecutiveErrorThreshold = config.errorthreshold || 35;
  const closedCasesTerm = config.closedcasesterm;
  const caseNumberSliceIndex = config.casenumbersliceindex;
  const monthsToRescrape = config.monthstorescrape || 2;
  const dispossessoryTerm = config.dispossessoryterm
  
  // GET FILEPATH OF PREVIOUS SCRAPE 
  const prevFileList = fs.readdirSync('./csvs/prev-scrape/');
  const prevFileName = 
    prevFileList.length > 0 &&
      prevFileList.find(filename => 
        filename.search(county) >= 0) ?
      prevFileList.find(filename => 
        filename.search(county) >= 0)
    : null;
  const prevFilepath =
    !fresh ?
      prevFileName ?
        `./csvs/prev-scrape/${prevFileName}`
        : config.prevfilepath
      : null;

  // SET FILEPATHS FOR SCRAPE AND ERROR LOG CSVS
  const errorListFilepath = `./csvs/errorlogs/${year}${county}CountyScrape-ERROR-LIST.csv`;
  const filename = `${dev ? 'DEV-' : ''}${year}${county}CountyEvictionCaseEvents-SCRAPE-${scrapeDate}`;
  const filepath = `./csvs/${dev ? 'dev/' : 'current-scrape/'}${filename}.csv`;

  // INITIATE ARRAYS, CONTROLS, AND COUNTERS 
  var updateList = [];
  let currentCaseNumber = startCase;
  let consecutiveErrors = 0;
  let lastScrapeEnd = 0;


  const logError = caseNumber => {
    const caseID = `${year}CM${caseNumber.toString().padStart(5, '0')}`
    
    fs.appendFile(errorListFilepath,
      `${caseID}, ${err} \n`
      , err => err ? console.log(err) : null);
  }

  const extract = async html => {
    // consectu = 0
    const $ = cheerio.load(html);
    const isEvictionCase = $('#cbd1').text().trim().toUpperCase() === dispossessoryTerm ? true : false;

    const caseRecord = {
      fileDate: null,
      caseID: null,
      plaintiff: null,
      plaintiffAddress: null,
      plaintiffCity: null,
      plaintiffPhone: null,
      plaintiffAttorney: null,
      defendantName1: null,
      defendantAddress1: null,
      defendantCity1: null,
      defendantPhone1: null,
      defendantAttorney1: null,
      defendantName2: null,
      defendantAddress2: null,
      defendantCity2: null,
      defendantPhone2: null,
      defendantAttorney2: null,
      caseStatus: null,
      address: null,
      events: null
    };

    const buildCaseRecord = async () =>
      $('.apps2 > tbody').each((i, elem) => {
      
        const tableInfoArray =
          $(elem).find('tr')
            .text()
            .split('\n')
            .map(item =>
              item.trim().replace(/["]/g, '')
            );
        // console.log(tableInfoArray);

        // From Table 0
        const caseID = i === 0 ? tableInfoArray[tableInfoArray.indexOf('Case Number:') + 1] : null,
          fileDate = i === 0 ? tableInfoArray[tableInfoArray.indexOf('Filing Date:') + 1] : null,
          caseStatus = i === 0 ?
            `${tableInfoArray[tableInfoArray.indexOf('Status:') + 1].split(',')[0]}` : null;
      
      


        // From Table 1
        // console.log(i === 3  ? tableInfoArray : null);

        const plaintiffInfo = tableInfoArray.includes('Plaintiff') && i === 1 ?
          tableInfoArray[tableInfoArray.indexOf('Plaintiff') - 5] === '' ?
            tableInfoArray[tableInfoArray.indexOf('Plaintiff') - 8] === '' ?
              tableInfoArray[tableInfoArray.indexOf('Plaintiff') - 1].split('  ')
              : tableInfoArray[tableInfoArray.indexOf('Plaintiff') - 8].split('  ')
            : tableInfoArray[tableInfoArray.indexOf('Plaintiff') - 5].split('  ')
          : null;
    
        // console.log(tableInfoArray);  

        let defendantInfo1 = null;
        let defendantInfo2 = null;
        let defendantAttorney1 = null;
        let defendantAttorney2 = null;

        const addDefendantInfo = () => i === 1 ? tableInfoArray.map((item, i) =>
          item === 'Defendant' && !defendantInfo1 ?
            defendantInfo1 = tableInfoArray[i - 5].split('  ')
            : item === 'Defendant' && !defendantInfo2 ?
              defendantInfo2 = tableInfoArray[i - 5] === '' ?
                defendantInfo2 = tableInfoArray[i - 1].split('  ')
                : defendantInfo2 = tableInfoArray[i - 5].split('  ')
              : null
        ) : null;

        const addDefendantAttorneyInfo = () => i === 1 ? tableInfoArray.map((item, i) =>
          item === 'Defendant' && !defendantAttorney1 ?
            defendantAttorney1 = tableInfoArray[i + 1]
            : item === 'Defendant' && !defendantAttorney2 ?
              defendantAttorney2 = tableInfoArray[i + 1]
              : null
        ) : null;

        const parseCity = addressInfo => {
          const city = 
            addressInfo.length > 1 ?
              addressInfo[addressInfo.length - 1]
              // .map(item =>
              //   item.search(', GA ') > -1 ?
              //     city = item
              //     : null)
              : null;
          return city;
        }

        const parseAddress = addressInfo => {
          // console.log(addressInfo)
          const address = 
            addressInfo.length > 1 ?
              addressInfo
                .slice(1, addressInfo.length - 1)
              // .map((item, i) =>
              //   i > 0 && item.search(', GA') === -1 ?
              //     address.push(item)
              //     : null)
              : null;
          if(address){
            return address.join(', ');
          }else{
            return null
          }
        }

        addDefendantInfo();
        addDefendantAttorneyInfo();

        const plaintiff = plaintiffInfo ? plaintiffInfo[0] : '',
          plaintiffAddress = plaintiffInfo ? parseAddress(plaintiffInfo) : '',
          plaintiffCity = plaintiffInfo ? parseCity(plaintiffInfo) : '',
          plaintiffPhone = '',
          plaintiffAttorney = tableInfoArray.includes('Plaintiff') && i === 1 ?
            tableInfoArray[tableInfoArray.indexOf('Plaintiff') + 1] : '',
          defendantName1 = defendantInfo1 ? defendantInfo1[0] : '',
          defendantAddress1 = defendantInfo1 ? parseAddress(defendantInfo1) : '',
          defendantCity1 = defendantInfo1 ? parseCity(defendantInfo1) : '',
          defendantPhone1 = '',
          defendantName2 = defendantInfo2 ? defendantInfo2[0] : '',
          defendantAddress2 = defendantInfo2 ? parseAddress(defendantInfo2) : '',
          defendantCity2 = defendantInfo2 ? parseCity(defendantInfo2) : '',
          defendantPhone2 = '';
  
        // Table 3

        const addEvents = () => {
          const events = [];
          const eventArray = tableInfoArray.filter(item => item !== '');
          eventArray.map((item, i) =>
            // Check for date
            item[2] === '/' && item[5] === '/' ? events.push({
              date: item,
              name: eventArray[i + 1],
              description: eventArray[i + 2]
            }) : null
          );
          return events;
        };

        const events = i === 3 ? addEvents() : null;
    
    
        switch (i) {
          case 0:
            caseRecord.caseID = caseID.split(' ')[0];
            caseRecord.fileDate = fileDate;
            caseRecord.caseStatus = caseStatus;
            break;
          case 1:
  
            caseRecord.plaintiff = plaintiff;
            caseRecord.plaintiffAddress = plaintiffAddress;
            caseRecord.plaintiffCity = plaintiffCity;
            caseRecord.plaintiffPhone = plaintiffPhone;
            caseRecord.plaintiffAttorney = plaintiffAttorney;
            caseRecord.defendantName1 = defendantName1;
            caseRecord.defendantAddress1 = defendantAddress1;
            caseRecord.defendantCity1 = defendantCity1;
            caseRecord.defendantPhone1 = defendantPhone1;
            caseRecord.defendantAttorney1 = defendantAttorney1;
            caseRecord.defendantName2 = defendantName2;
            caseRecord.defendantAddress2 = defendantAddress2;
            caseRecord.defendantCity2 = defendantCity2;
            caseRecord.defendantPhone2 = defendantPhone2;
            caseRecord.defendantAttorney2 = defendantAttorney2;
            caseRecord.address = `${defendantAddress1}, ${defendantCity1}`;
            break;
          case 3:
            caseRecord.events = events[0] ? events : [];
        }
    
    // console.log(caseRecord)
      })
  
    if (isEvictionCase) {
      await buildCaseRecord();
      return caseRecord;
    }
    return null

  };

  const navigation = caseNumber => {
  
    nightmare
      .goto(`https://weba.co.clayton.ga.us/casinqcgi-bin/wci010r.pgm?rtype=E&dvt=V&opt=&ctt=M&cyr=${year}&ctp=CM&csq=${caseNumber.toString().padStart(5, '0')}&jdg=&btnSrch=Submit+Case+Search`)
      .wait('body')
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        const badResponseType = response.includes('Case# not found')
          ? 'Case# not found'
          : response.includes('Proxy Error')
            ? 'Proxy Error'
            : 'Unknown'
        
        !response.includes('Case# not found') && 
        !response.includes('Proxy Error')
          ? extract(response)
              .then(caseRecord => {
                if (caseRecord) {
                  caseEventsToCSV(caseRecord, filepath, fields);
                  consecutiveErrors=0;
                }
              })
          : ( consecutiveErrors++,
              console.log("consecutiveErrors", consecutiveErrors),
              console.log("currentCaseNumber",currentCaseNumber),
              logError(currentCaseNumber, `BAD RESPONSE: ${badResponseType}`))

        currentCaseNumber++;
        scrape(currentCaseNumber);
      })
      .catch(err => {
        console.log(`${err} on casenumber ${caseNumber}`);
        consecutiveCasesNotFound++;
        logError(caseNumber);
        currentCaseNumber++;
        scrape(currentCaseNumber);
      })
  };

  const scrape = caseNumber => {
    consecutiveErrors < consecutiveErrorThreshold 
      ? fresh ||
        onlynew ||
        caseNumber > lastScrapeEnd ||
        (caseNumber <= lastScrapeEnd && updateList.includes(caseNumber))
          ? navigation(caseNumber)
          : (currentCaseNumber++, scrape(currentCaseNumber))
      : nightmare
        .end()
        .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  initiate({
      startCase: startCase,
      prevFilepath: prevFilepath,
      monthsToRescrape :monthsToRescrape,
      fresh: fresh,
      onlynew: onlynew,
      year: year,
      county: county,
      closedCasesTerm: closedCasesTerm,
      fields: fields,
      filepath: filepath,
      caseNumberSliceIndex: caseNumberSliceIndex,
      append: append
    }).then(obj => {
        console.log(`Scrape of ${county} County started @ ${scrapeTimeStart} on ${scrapeDate}`);
        console.log('Initiation object:',obj);
        updateList = obj.updateList;
        lastScrapeEnd = obj.lastScrapeEnd;
        currentCaseNumber = obj.currentCaseNumber;
        scrape(currentCaseNumber);

    }).catch(err => console.log('Error initiating:', err));
};



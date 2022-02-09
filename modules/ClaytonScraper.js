const Nightmare = require('nightmare');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const csv = require('csv-parser');
const eventToCsvRow = require('../utils/eventToCsvRow');


module.exports = config => {
  // console.log(config);   
  const nightmare = Nightmare({ show: config.show });
  const county = 'Clayton';
  const prevFileList = fs.readdirSync('./csvs/prev-scrape/');
  const prevFileName = 
    prevFileList.length > 0 &&
    prevFileList.find(filename => filename.search(county) >= 0) ?
      prevFileList.find(filename => filename.search(county) >= 0)
    : null;

  const dev = config.dev;
  const startCase = config.startcase ? config.startcase : 1;
  var year = config.year ? config.year.toString() : '2020';
  const finalYear = config.finalYear ? config.finalYear.toString() : '2020';
  const fresh = config.fresh;
  const onlynew = config.onlynew;
  const prevFilepath =
    !fresh ?
      prevFileName ?
        `./csvs/prev-scrape/${prevFileName}`
        : config.prevfilepath
      : null;
  const filetype = 'csv';
  const filename = `${dev ? 'DEV-' : ''}${year}${county}CountyEvictionCaseEvents-SCRAPE-${moment().format('MM-DD-YYYY')}`;
  const filepath = `./csvs/${dev ? 'dev/' : 'current-scrape/'}${filename}.${filetype}`;
  var prevList = [];
  var closedCases = [];
  const closedCasesTerm = 'Disposed';
  const errorListFilepath = `./csvs/errorlogs/${year}${county}CountyScrape-ERROR-LIST.csv`;
  const fields = config.fields;
  
  const headerRow = fields.map((field, i) =>
    `${field}${i !== fields.length - 1 ? '' : '\n'}`
  )

  fs.writeFile(filepath, headerRow.toString(), err => {
    err ? console.log(err) : null
  });

  console.log(`Started scraping ${county} County @ ${moment().format('hh:mm [on] M/D/YY')}`)

  const caseNotFoundThreshold = 10;
  let currentCaseNumber = startCase;
  let consecutiveCasesNotFound = 0;

  const logError = caseNumber => {
    fs.appendFile(errorListFilepath,
      `${year}CM${caseNumber.toString().padStart(5, '0')}` + '\n'
      , err => err ? console.log(err) : null);
  }

  const nextScrape = () => {
    currentCaseNumber++;
    scrape(currentCaseNumber);
  };

  const extract = caseNumber => {
  
    nightmare
      .goto(`https://weba.co.clayton.ga.us/casinqcgi-bin/wci010r.pgm?rtype=E&dvt=V&opt=&ctt=M&cyr=${year}&ctp=CM&csq=${caseNumber.toString().padStart(5, '0')}&jdg=&btnSrch=Submit+Case+Search`)
      .wait('body')
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        // console.log('response recieved')
        (response.search('Case# not found') === -1 && response.search('Proxy Error') === -1)?
          getDataAndWriteToCSV(response)
          : consecutiveCasesNotFound++;

        // console.log(consecutiveCasesNotFound)

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
	   // console.log(closedCases)
    const caseID = `${year}CM${caseNumber.toString().padStart(5, '0')}`

    // console.log(caseNumber)
    consecutiveCasesNotFound < caseNotFoundThreshold ?
      closedCases.includes(caseID) === false ||
        fresh ||
        onlynew ?
        extract(caseNumber)
        : nextScrape()
      : scrapeUntilFinalYear()
  };

  const scrapeUntilFinalYear = () => {
    //reset error checker
    consecutiveCasesNotFound = 0;
    // go to next year
    year++;
    //reset case number 
    currentCaseNumber = 1;

    closedCases = []

    prevList = []

    // if the current year more than final year, stop
    year <= finalYear ?
    calCurrentCaseNumberForYear()
    :nightmare
    .end()
    .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  const getDataAndWriteToCSV = html => {
    consecutiveCasesNotFound = 0
    const $ = cheerio.load(html);
    const isEvictionCase = $('#cbd1').text().trim().toUpperCase() === 'DISPOSSESSORY' ? true : false;

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

    const buildCaseRecord = () => {
      isEvictionCase ?
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
              caseRecord.events = events;
          }
		  
		  // console.log(caseRecord)
        })
        : null
    };

    const writeEventsToCSV = () => {
		
      isEvictionCase && caseRecord.events.length > 0 ?
        [...caseRecord.events].reverse().map((event, i) =>
          fs.appendFile(filepath,
            eventToCsvRow(fields, caseRecord, event, i).toString(),
            err => {
              err ? console.log(err) : null
            }
          )
        ) : null;
    };

    buildCaseRecord();
    writeEventsToCSV();
  }

  const calCurrentCaseNumberForYear = () =>{
    fs.createReadStream(prevFilepath)
        .pipe(csv())
        .on('data', row => {
          const rowObj = new Object(row);
          const caseNumber = parseInt(rowObj['caseID'].slice(6));

          var dateCutOff = new Date();
          dateCutOff.setMonth(dateCutOff.getMonth() - 3);
          dateCutOff.setDate(1);
          var dateCase = new Date(rowObj['fileDate']);

          if (rowObj['caseID'].slice(0, 4) == year.toString()){

          onlynew 
             ?
            fs.appendFile(
              filepath,
              fields.map((field, i) =>
                `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
              ).toString(),
              err => err ?
                console.log(err)
                : null
            )
            : (rowObj['caseStatus'].search(closedCasesTerm) >= 0 || dateCase < dateCutOff )? fs.appendFile(
              filepath,
              fields.map((field, i) =>
                `"${rowObj[field] ? rowObj[field] : ''}"${i === fields.length - 1 ? '\n' : ''}`
              ).toString(),
              err => err ?
                console.log(err)
                : null
            ): null;

            onlynew ?
            !prevList.includes(caseNumber) ?
              prevList.push(caseNumber)
              : null
            : (dateCase < dateCutOff)?
                // PUSH OPEN (NON-CLOSED) CASES TO ARRAY TO LIMIT SCRAPER TO ONLY THOSE CASES
                !prevList.includes(caseNumber) ?
                prevList.push(caseNumber)
                : null 
              : null;

          !onlynew &&
            (!closedCases.includes(rowObj['caseID']) &&
            (rowObj['caseStatus'].search(closedCasesTerm) >= 0 || dateCase < dateCutOff))?
            closedCases.push(rowObj['caseID'])
            : null;
            }
        })
        .on('end', () => {
          prevList.length > 0?
          currentCaseNumber = prevList.sort(function(a, b) { return b - a; })[10]
          :currentCaseNumber = 1
          // console.log(currentCaseNumber)
          scrape(currentCaseNumber)
        })
  }

  const initiate = () => {
    !fresh && 
    prevFilepath ?
    calCurrentCaseNumberForYear()
      : scrape(currentCaseNumber);
  };

  initiate();
};



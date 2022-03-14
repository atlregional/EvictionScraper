const Nightmare = require('nightmare');
const cheerio = require('cheerio');
const moment = require('moment');
const fs = require('fs');
const csv = require('csv-parser');
const eventToCsvRow = require('../utils/eventToCsvRow');


module.exports = config => {
  // console.log(config);   
  var nightmare = Nightmare({ 
    show: config.show,
    waitTimeout: config.timeout ? config.timeout : 20000
   });
  const county = 'Henry';
  const prevFileList = fs.readdirSync('./csvs/prev-scrape/');
  const prevFileName = 
    prevFileList.length > 0 &&
    prevFileList.find(filename => filename.search(county) >= 0) ?
      prevFileList.find(filename => filename.search(county) >= 0)
    : null;
  const monthsToRescrape = 2;

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
  const closedCasesTerm = 'Closed';
  const errorListFilepath = `./csvs/errorlogs/${year}${county}CountyScrape-ERROR-LIST.csv`;
  const fields = config.fields;
  
  const headerRow = fields.map((field, i) =>
    `${field}${i !== fields.length - 1 ? '' : '\n'}`
  )

  fs.writeFile(filepath, headerRow.toString(), err => {
    err ? console.log(err) : null
  });

  console.log(`Started scraping ${county} County @ ${moment().format('hh:mm [on] M/D/YY')}`)

  const caseNotFoundThreshold = config.errorthreshold?config.errorthreshold:10;
  let currentCaseNumber = startCase;
  let consecutiveCasesNotFound = 0;

  const logError = caseNumber => {
    fs.appendFile(errorListFilepath,
      `${year.toString().slice(2)}0${caseNumber.toString().padStart(5, '0')}S` + '\n'
      , err => err ? console.log(err) : null);
  }

  const nextScrape = () => {
    currentCaseNumber++;
    // nightmare
    //   .wait('#btnnewsearchup')
    //     .click('#btnnewsearchup')
    //     .then(() =>{
            scrape(currentCaseNumber)
        // })
        // .catch(err => {
        //   console.log('next scrape fail')
        //     console.log(`${err} on casenumber ${currentCaseNumber}`);
        //     // nightmare
        //     //   .end()
        //     //   .then(()=>{
                
        //     //     // console.log('refresh nighmare session')
        //     //     nightmare = new Nightmare(
        //     //       {
        //     //         show: config.show,
        //     //         waitTimeout: config.timeout ? config.timeout : 20000
        //     //       }
        //     //     );
        //         scrape(currentCaseNumber);
        //       //   console.log(consecutiveCasesNotFound)
        //       // })
        //     // nightmare
        //     // .end()
        //     // .then(()=>{
        //     //   // console.log('refresh nighmare session')
        //     //   nightmare = new Nightmare(
        //     //     {
        //     //       show: config.show,
        //     //       waitTimeout: config.timeout ? config.timeout : 20000
        //     //     }
        //     //   );
        //       // scrape(currentCaseNumber);
        //     // })
        // })
  };

  const extract = caseNumber => {

    var caseID =  `MGCD${year.toString()}0${caseNumber.toString().padStart(5, '0')}`;

    // console.log(caseNumber)

    nightmare
      .goto(`https://micropact.co.henry.ga.us/MagistrateSearch/msearchcase.aspx?newsrch=1`)
      .wait("#_ctl0_ContentPlaceHolder1_SearchCase1_ddlCtDiv")
      // .wait(1000)
    
      .evaluate(function() {
        document.getElementsByName("_ctl0:ContentPlaceHolder1:SearchCase1:ddlCtDiv")[0].options[2].selected = true;
        })

    //   .click('select[id="_ctl0_ContentPlaceHolder1_SearchCase1_ddlCtDiv"] option[value="MG"]')
      .insert(
        "input[name='_ctl0:ContentPlaceHolder1:SearchCase1:txtYear']", 
        year
      )
      .evaluate(() =>
        document.querySelector(
          "input[name='_ctl0:ContentPlaceHolder1:SearchCase1:txtSeq']"
        ).value = null)
      .insert(
        "input[name='_ctl0:ContentPlaceHolder1:SearchCase1:txtSeq']", 
        caseNumber
      ).wait("#_ctl0_ContentPlaceHolder1_SearchCase1_btnFindCase")
      //for random error first click submit button does not work 
      .click("#_ctl0_ContentPlaceHolder1_SearchCase1_btnFindCase")
    //   .wait(`a.btn`)
    //   .click(`a.btn`)
      .wait(2000)
      .evaluate(() =>
        document.querySelector('body').innerHTML
      )
      .then(response => {
        // console.log('response recieved')
        // (response.search('12/31/1969') === -1 )?
          // getDataAndWriteToCSV(response)
        //   : consecutiveCasesNotFound++;

        // console.log(consecutiveCasesNotFound)
        // scrape(currentCaseNumber);

        if (response.search('No results for that search criteria') != -1){

          console.log('No results for that search criteria')

          currentCaseNumber++;
          consecutiveCasesNotFound++;

          scrape(currentCaseNumber);
          console.log(consecutiveCasesNotFound)

        }else{
          getDataAndWriteToCSV(response)
        }

      })
      .catch(err => {
        console.log('extract Fail')
        console.log(`${err} on casenumber ${currentCaseNumber}`);
        // consecutiveCasesNotFound++;
        logError(caseNumber);

          // nightmare
          // .end()
          // .then(()=>{
            
          //   // console.log('refresh nighmare session')
          //   nightmare = new Nightmare(
          //     {
          //       show: config.show,
          //       waitTimeout: config.timeout ? config.timeout : 10000
          //     }
          //   );
            
          // })
          nightmare
          
              .end()
              .then(()=>{
                
                // console.log('refresh nighmare session')
                nightmare = new Nightmare(
                  {
                    show: config.show,
                    waitTimeout: config.timeout ? config.timeout : 20000
                  }
                );
            scrape(currentCaseNumber);
            console.log(consecutiveCasesNotFound)
          })
      
        })
        
     
  
        

        

    
        // nightmare
        // .wait("#_ctl0_ContentPlaceHolder1_SearchCase1_btnnewsearch")
        // .click("#_ctl0_ContentPlaceHolder1_SearchCase1_btnnewsearch")
        // .then(() => {
        //     currentCaseNumber++;
            
        // })
        
        
    
  };

  const scrape = caseNumber => {
	   // console.log(closedCases)
    const caseID = `MGCD${year.toString()}0${caseNumber.toString().padStart(5, '0')}`;
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
    prevList = [] 
    closedCases = []
    currentCaseNumber = 1;
    // if the current year more than final year, stop
    year <= finalYear ?
    createCurrentFileAndSetStartCase()
    :nightmare
    .end()
    .then(console.log(`${county} County Scrape Complete @ ${moment().format('hh:mm [on] M/D/YY')}`))
  };

  const getDataAndWriteToCSV = html => {
    consecutiveCasesNotFound = 0
    var $ = cheerio.load(html);
    

    // const rowInfoSummaryArray = $('.card-body > .row ').find('.col-md-4').text().split('\n').map(item =>
    //   item.trim().replace(/["]/g, '')
    // )

    // const isEvictionCase = rowInfoSummaryArray[rowInfoSummaryArray.indexOf('Case Type') + 1].toUpperCase() === 'DISPOSSESSORY' ? true : false;

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
      // events: null
    };

    var tableLength = $("table#PartyGrid_grdParty tr").length

    const extractCaseAddress = (i,addressField,cityField) =>{

      
        nightmare
            .wait('#PartyGrid_grdParty')
            .evaluate((selector,i) => {
                let elements = document.querySelectorAll(selector);
                elements[i].click()
                // Array.from(elements).forEach((element) => element.click());
            }, 'table#PartyGrid_grdParty tr', i)
            .wait('#lblAdd1')
            .evaluate(() =>
                document.querySelector('body').innerHTML
            )
            .then(response => {
        
                // console.log(i)
                 $ = cheerio.load(response);
                const address = $('#lblAdd1').text() ? $('#lblAdd1').text() : null
                const city = $('#lblCity').text() ? $('#lblCity').text() : null
                // console.log($('#lblLName').text())
                caseRecord[addressField] = address
                caseRecord[cityField] = city

                nightmare
                .wait(1000)
                .click("#btnrtucase")
                .catch(err => {
                  console.log('return to case profile fail')
                  console.log(`${err} on casenumber ${currentCaseNumber}`);
                  })

                // console.log(i,tableLength - 1)

                if ( i ==   tableLength - 1){
                    caseRecord.address = `${caseRecord.defendantAddress1}, ${caseRecord.defendantCity1}, GA`;
                    

                    nightmare

                    // .wait("#btnProc")
                    .wait(5000)
                    .click("#btnProc")
               
               
                    .wait("#ProcGrid_grdProc")
                    .evaluate(() =>
                        document.querySelector('body').innerHTML
                    )
                    .then(response2 => {
                        // console.log(response)
                        if(response2.search('No proceedings on record for this case') != -1){
                          fs.appendFile(
                            filepath,
                            fields.map((field, i) =>
                              `"${caseRecord[field] ? caseRecord[field] : ''}"${i !== fields.length - 1 ? '' : '\n'}`
                              ).toString(),
                            (err) => {
                              err ? console.log(err) : null;
                            }
                          )
                          nextScrape();
                        }
                        else{
                          $ = cheerio.load(response2);

           
                          const eventInfoArray = []

                          var tableData = $("table#ProcGrid_grdProc tr").find('td');
                          if (tableData.length > 0) {

                              tableData.each(function() { eventInfoArray.push($(this).text()); });
                          
                          }

                          const addEvents = () => {
                              const events = [];
                              const eventArray = eventInfoArray.filter(item => item !== '');
                              eventArray.map((item, i) =>
                                // Check for date
                                item[2] === '/' && item[5] === '/' ? events.push({
                                  date: item,
                                  name: eventArray[i - 1],
                                  description: ''
                                }) : null
                              );
                              return events;
                            };

                          // console.log(eventInfoArray)

                          caseRecord.events =  addEvents()

                          // console.log(caseRecord)

                          const writeEventsToCSV = () => {
  
                              caseRecord.events.length > 0 ?
                                [...caseRecord.events].reverse().map((event, i) =>
                                  fs.appendFile(filepath,
                                    eventToCsvRow(fields, caseRecord, event, i).toString(),
                                    err => {
                                      err ? console.log(err) : null
                                    }
                                  )
                                ) : null;
                            };

                            writeEventsToCSV();
                            nextScrape();
                        }
                     
                    })
                    .catch(err => {
                      console.log('getProceeding fail')
                      console.log(`${err} on casenumber ${currentCaseNumber}`);
                        
                      // nightmare
                      // .end()
                      // .then(()=>{
                        
                      //   // console.log('refresh nighmare session')
                      //   nightmare = new Nightmare(
                      //     {
                      //       show: config.show,
                      //       waitTimeout: config.timeout ? config.timeout : 20000
                      //     }
                      //   );
                        scrape(currentCaseNumber);
                        // console.log(consecutiveCasesNotFound)
                      // })
                        // nightmare
                        // .evaluate(() =>
                        //   document.querySelector('body').innerHTML
                        // ).then(response => {
                        //   if(response.search('No proceedings on record for this case') == -1)
                        //   {
                        //     scrape(currentCaseNumber)
                        //   }
                        //   else{
                        //     fs.appendFile(
                        //       filepath,
                        //       fields.map((field, i) =>
                        //        `"${caseRecord[field] ? caseRecord[field] : ''}"${i !== fields.length - 1 ? '' : '\n'}`
                        //        ).toString(),
                        //       (err) => {
                        //         err ? console.log(err) : null;
                        //       }
                        //     )
                        //     nextScrape(); 
                        //   }
                        // })
                        // .catch(err2 => {
                        //   console.log(`${err2} on casenumber ${currentCaseNumber}`);
                
                        //   // scrape(currentCaseNumber);
                      
                        // })
                          
                          
                        // nightmare
                        // .end()
                        // .then(()=>{
                        //   // console.log('refresh nighmare session')
                        //   nightmare = new Nightmare(
                        //     {
                        //       show: config.show,
                        //       waitTimeout: config.timeout ? config.timeout : 20000
                        //     }
                        //   );

                          
                          
                        // })
                    })
                

                
                  }

                

            })
            
            .catch(err3 => {
              console.log('get party detail fail')
              console.log(`${err3} on casenumber ${currentCaseNumber}`);

              // nightmare
              // .end()
              // .then(()=>{
                
                // console.log('refresh nighmare session')
                // nightmare = new Nightmare(
                //   {
                //     show: config.show,
                //     waitTimeout: config.timeout ? config.timeout : 20000
                //   }
                // );
                scrape(currentCaseNumber);
              //   console.log(consecutiveCasesNotFound)
              // })
              // nightmare
              // .end()
              // .then(()=>{
              //   // console.log('refresh nighmare session')
              //   nightmare = new Nightmare(
              //     {
              //       show: config.show,
              //       waitTimeout: config.timeout ? config.timeout : 20000
              //     }
              //   );
              // scrape(currentCaseNumber);
                
              // })
            })
    }

    

    

    const buildCaseRecord = () => {

      var defendantsCount = 0;

      const caseID = $('#txtCase').text() ? $('#txtCase').text() : null,
            
      caseStatus = $('#chkActive').prop('checked') ?
          'Active' : 'Closed';


      const fileDate = $('#txtFilingDate').text() ? $('#txtFilingDate').text() : null;

      caseRecord.caseID = caseID.split(' ')[0];
      caseRecord.fileDate = fileDate;
      caseRecord.caseStatus = caseStatus;

      
      // var partyInfoArray = []
      // $("table#PartyGrid_grdParty tr").each((i, elem) => {

      //   // setTimeout(function () {
          
  

      //   // },2000 * i)
             
    
   
      // })

      const tableTrs = $("table#PartyGrid_grdParty tr")

      const extractAlladdress= (i,elem) => {
        
   
          const partyInfoArray = []



          nightmare.wait(2000).then(()=>{
            var tableData = $(elem[i]).find('td');
            if (tableData.length > 0) {
                tableData.each(function() { partyInfoArray.push($(this).text()); });
            
            }

          
            if (partyInfoArray.includes('PL') ){
    
                caseRecord.plaintiff = partyInfoArray[partyInfoArray.indexOf('PL') - 1]
                extractCaseAddress(i,'plaintiffAddress','plaintiffCity')
            }
              

            partyInfoArray.includes('DF') ?
                defendantsCount += 1
                :null

            if ( partyInfoArray.includes('DF') ){
                caseRecord['defendantName'+defendantsCount.toString()] =partyInfoArray[partyInfoArray.indexOf('DF') - 1]
                extractCaseAddress(i,'defendantAddress'+defendantsCount.toString(),'defendantCity'+defendantsCount.toString())

            }

            
          }).then(()=>{
            if (i < tableLength -1)
            extractAlladdress (i+1,elem)
          }).catch(err3 => {
            console.log('extract address fail')
            // nightmare
            //   .end()
            //   .then(()=>{
                
            //     // console.log('refresh nighmare session')
            //     nightmare = new Nightmare(
            //       {
            //         show: config.show,
            //         waitTimeout: config.timeout ? config.timeout : 20000
            //       }
            //     );
                scrape(currentCaseNumber);
              //   console.log(consecutiveCasesNotFound)
              // })
          })
        
        
        }
    // const doNextPromise = (d) => {
    //   extractAlladdress(d, tableTrs[d])
    //     .then(()=>{
    //         d++;

    //         // if (d < tableLength)
    //         // doNextPromise(d)
    //     })
    // }

    //   doNextPromise(1)

      extractAlladdress(1,tableTrs)

      

    };

    

    buildCaseRecord();
    
  }

  const initiate = () => {
    !fresh && 
    prevFilepath ?
    createCurrentFileAndSetStartCase()
      : scrape(currentCaseNumber);
  };

  const createCurrentFileAndSetStartCase = () =>{
    var dateCutOff = new Date();
    dateCutOff.setMonth(dateCutOff.getMonth() - monthsToRescrape);
    dateCutOff.setDate(1);

    fs.createReadStream(prevFilepath)
        .pipe(csv())
        .on('data', row => {
          const rowObj = new Object(row);
          const caseNumber = parseInt(rowObj['caseID'].slice(8));

          var dateCase = new Date(rowObj['fileDate']);

          if (rowObj['caseID'].slice(4, 8) == year || !fresh){
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
            : (rowObj['caseStatus'].search(closedCasesTerm) >= 0 || dateCase < dateCutOff)? fs.appendFile(
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
          prevList.length > 0 ?
          currentCaseNumber = prevList.sort(function(a, b) { return b - a; })[3]
          :null
         
          scrape(currentCaseNumber)
        })
  }

  initiate();
};



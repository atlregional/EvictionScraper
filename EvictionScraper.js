
//change the work directory
// console.log(__dirname)
process.chdir(__dirname);


// IMPORT DEPENDENCIES
const fs = require('fs');

// IMPORT SCRAPER MODULES
const ClaytonScraper = require('./modules/ClaytonScraper');
const CobbScraper = require('./modules/CobbScraper');
const MaconbibbScraper = require('./modules/MaconbibbScraper');
const HenryScraper = require('./modules/HenryScraper');
const OdysseyScraper = require('./modules/OdysseyScraper');

// IMPORT SCRAPER CONFIGURATION OBJECT FROM CONFIG MODULE
const scraperConfigs = require('./utils/config')();

// INITIATE ERROR LOG FILES FOR ACTIVE SCRAPERS
Object.entries(scraperConfigs).map((county, countyConfig) =>
  countyConfig.active ?
    fs.writeFile(`./csvs/errorlogs/${countyConfig.year}${county}CountyScrape-ERROR-LIST.csv`, 'caseID', 
      err => {
        err ? console.log(err) : null
      }
    )
    : null
);

// INITIATE SCRAPERS ON ODYSSEY SITES
// Object.values(scraperConfigs).map(config =>
//   config.active && 
//   config.odyssey ? 
//     OdysseyScraper(config) 
//   : null
// ); 






if (process.argv[2] == 'Gwinnett'){

  setTimeout(function(){
    scraperConfigs['Gwinnett'].active ?
    OdysseyScraper(scraperConfigs['Gwinnett'])
    : null;
  },1000)

}else if (process.argv[2] == 'Fulton'){

  setTimeout(function(){
    scraperConfigs['Fulton'].active ?
    OdysseyScraper(scraperConfigs['Fulton'])
    : null;
  },5000)

}else if (process.argv[2] == 'Chatham'){

  scraperConfigs['Chatham'].active ?
    OdysseyScraper(scraperConfigs['Chatham'])
    : null;

}else if (process.argv[2] == 'Clayton'){

  scraperConfigs['Clayton'].active ?
  ClaytonScraper(scraperConfigs['Clayton'])
  : null;
  
}

if (process.argv[3] == 'DeKalb'){

  setTimeout(function(){
    scraperConfigs['DeKalb'].active ?
    OdysseyScraper(scraperConfigs['DeKalb'])
    : null;
  },10000)

}else if (process.argv[3] == 'Maconbibb'){

  setTimeout(function(){
    scraperConfigs['Maconbibb'].active ?
      MaconbibbScraper(scraperConfigs['Maconbibb'])
      : null;
  },15000)

}else if (process.argv[3] == 'Henry'){

  scraperConfigs['Henry'].active ?
  HenryScraper(scraperConfigs['Henry'])
  : null;

}
else if (process.argv[3] == 'Cobb'){

  scraperConfigs['Cobb'].active ?
  CobbScraper(scraperConfigs['Cobb'])
  : null;

}

// setTimeout(function(){
  
// },1000)

// setTimeout(function(){

// },5000)





// // INITIATE SCRAPER ON CLAYTON COUNTY SITE






// // INITIATE SCRAPER ON COBB COUNTY SITE



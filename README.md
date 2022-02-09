# evictionScraper

This project is started on the basis of https://github.com/spinozist/Eviction-Tracker which was developed by **Erik Woodworth, Research & Data Visualization Coordinator** at the **Atlanta Regional Commission (ARC)**, in furtherance of the goals of the **Metro Atlanta Eviction Data Collective (MAEDC)**, a partnerhsip between the **Atlanta Regional Commission (ARC)**, **Georgia Tech's School of City and Regional Planning (SCaRP)** and **Center for Spatial Planning, Analysis, and Visualization (CSPAV)**, and the **Federal Reserve Bank of Atlanta**. \\

Below is copied from https://github.com/spinozist/Eviction-Tracker

# Eviction Tracker

## Description
This application was built to gather eviction case records from public-facing court record systems.  If relies on [Nightmare.js](http://www.nightmarejs.org/) to navigate the court record sites and [Cheerio.js](https://cheerio.js.org/) to parse the HTML in order to obtain pertinent information from each eviction filing record.


## Getting Started
### You will need a username and password to scrape Tyler Oddessey Portal (DeKalb, Gwinnett, and Fulton):
- Create an .env file with the following variables. Get a username and password by registering at https://georgia.tylerhost.net/ofsweb/:
    ```
    USERANAME=###### 
    PASSWORD=###### 
    ```

### Create file structure
```
  |-csvs/
    |- current-scrape/
    |- prev-scrape/
    |- errorlogs/
    |- dev/
```

### Install using npm:
- `$ npm install`

### Run using Node:
- If first time (with no CSVs of previous scrapes in *./csvs/prev-scrape/*):
  - `$ node EvictionScrapers.js -fresh`
- If you have CSVs of previous scrapes and want to check for updates to open cases as well as new cases (requires CSVs of previous scrapes in in *./csvs/prev-scrape/*):
  - `$ node EvictionScrapers.js`
- If you only want the newest cases without checking for updates since the previous scrape (requires CSVs of previous scrapes in *./csvs/prev-scrape/*):
  - `$ node EvictionScrapers.js -onlynew`

## Customize
### Configuration options can be made globally or for each county in *config.json*

- **year** (number) 
  - Sets the year for cases to be scraped
  - in `YYYY` format
- **dev** (boolean) 
  - If `true` scraped csvs are written to *./csvs/dev/*
  - If `false` (false) scraped csvs are written to *./csvs/current-scrape/*
- **active** (boolean)
  - If `true` (default) the scraper will run
- **show** (boolean)
  - If `true` a browser screen will be shown while running
- **fields** (array of strings)
  - Sets the fields to be scraped
  - *All available fields are shown in the global config example below*
- **errorthreshold** (number)
  - Set how many consecutive errors to log before stopping the scraper 
  - *default is 35*
- **startcase** (number)
  - Sets case number on which to begin scraper
  - *default is 1*
- **errorcleanup** (boolean)
  - If `true` after the errorthreshold is met and if there are any errors (not included in the consecutive errors at the end of the scrape) the scraper will loop through the list of error case numbers to double check if case information is available before ending.
  - If `false` (default) the scraper will end without double checking errors
- **fresh** (boolean) 
  - If `true` the scraper will begin on the startcase and scrape each consecutive case to a new file in *./csvs/current-scrape/* (based on selected fields) until the errorthreshold is met.
  - If `false` (default) the closed cases of the previous scrape will be appended to a new file in *./csvs/current-scrape/* (based on selected fields) with rescraped open cases and new cases appended to that file until the errorthreshold is met.
  - *This can be set globally with CLI by appending `-fresh` to node run of application*
- **onlynew** (boolean)
  - If `true` the previous scrape will be appended to a new file in *./csvs/current-scrape/* (based on selected fields) with each new case (beginning after that last case number in the previous scrape) appended to that file until the errorthreshold is met.
  - If `false` (default) the closed cases of the previous scrape will be appended to a new file in *./csvs/current-scrape/* (based on selected fields) with rescraped open cases and new cases appended to that file until the errorthreshold is met.
  - *This can be set globally with CLI by appending `-onlynew` to node run of application*

#### Global Example:
```
"Global" : {
  "year" : 2020,
  "dev" : false,
  "active" : true, 
  "show" : false,
  "errorcleanup" : true
  "fields" : [
      "fileDate",
      "caseID",
      "plaintiff",
      "plaintiffAddress",
      "plaintiffCity",
      "plaintiffPhone",
      "plaintiffAttorney",
      "defendantName1",
      "defendantAddress1",
      "defendantCity1",
      "defendantPhone1",
      "defendantAttorney1",
      "defendantName2",
      "defendantAddress2",
      "defendantCity2",
      "defendantPhone2",
      "defendantAttorney2",
      "caseStatus",
      "eventNumber",
      "eventDate",
      "eventName",
      "eventDescription",
      "judgmentType",
      "judgmentFor",
      "judgmentComp",
      "address"
  ]
}
```

#### County Example (overwrites Global configurations):
```
"Gwinnett" : {
  "show" : true,
  "errorthreshold" : 100,
  "startcase" : 2019
}
```

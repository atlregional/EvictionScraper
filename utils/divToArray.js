// IMPORT DEPENDENCY TO PARSE HTML
const cheerio = require('cheerio');

// EXPORT MODULE TO PARSE DIVS TO ARRAY
module.exports = (html, divID) => {
  const $ = cheerio.load(html);
  const array = $(`#${divID}`)
      .text()
      .split("\n")
      .map((item) => item.trim().replace(/["]/g, ''))
      .filter(item => item !== '')
      ;
  return array;
}

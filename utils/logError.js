const fs = require('fs');

module.exports = ({caseNumber, err, errorListFilepath, year}) => {
  var caseID = `${year.toString().slice(2)}ED${caseNumber.toString().padStart(5, '0')}`;

  fs.appendFile(errorListFilepath,
  `${caseID}, ${err} \n`
  , err => err ? console.log(err) : null);
};
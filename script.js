const pdfjsLib = window['pdfjs-dist/build/pdf'];
let chart;

// Update the HTML table with extracted data
function updateTable(data) {
    const table = document.getElementById('dataTable');
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = ''; // Clear existing rows

    data.forEach(r => {
        const row = document.createElement('tr');
        r.forEach((el) => {
            if (isValidDateTimeFormat(el)) {
                el = formatDate(el);
            }
            row.innerHTML += `<td>${el}</td>`;
        });
        for (let i = r.length; i < 6; i++) {
            row.innerHTML += `<td></td>`;
        }
        tbody.appendChild(row);
    });


    table.classList.remove('hidden'); // Show the table
}

// Function to group test data by test name
function groupByTestName(data) {
    const groupedData = {};

    data.forEach((row) => {
        const [dateTime, testName, result, range, normalcy] = row;

        if (result.trim().length > 0 && "0123456789.".includes(result.trim()[0])) { // numeric value
            if (!groupedData[testName]) {
                groupedData[testName] = [];
            }
            groupedData[testName].push({ dateTime, result: parseFloat(result), range, normalcy });
        }

    });

    return groupedData;
}

// Function to create a bar chart for each test
function createChartForTest(testName, testData) {
    testData.sort((a, b) => a.dateTime > b.dateTime ? 1 : -1);

    const container = document.getElementById('charts-container');

    const dates = testData.map(item => item.dateTime.substring(0, 10));
    const results = testData.map(item => item.result);
    const normalcy = testData.map(item => item.normalcy);
    const ranges = testData.map(item => item.range);

    // convert ranges to numeric values
    // ex: 3.4mmol/L - 11 mmol/L -> [3.4, 11]
    // ex: 4.5x10*12/L - 6.5 x10*12/L -> [4.5, 6.5]
    const rangesNum = ranges.map((range) => {
        var [min, max] = range.split('-');
        if (!min || !max) { return [NaN, NaN] }
        min = min.replace(' ', '')
        max = max.replace(' ', '')
        min = min.split(/^.0123456789/)[0]
        max = max.split(/^.0123456789/)[0]
        const minNum = parseFloat(min);
        const maxNum = parseFloat(max);
        // console.log(testName, minNum, maxNum)

        return [minNum, maxNum];
    });
    // console.log(testName)
    // console.log(rangesNum);

    const canvas = document.createElement('canvas');
    container.appendChild(canvas);

    const annotations = {};

    rangesNum.forEach((range, i) => {
        if (!range[0] && !range[1]) { return }
        annotations[`referenceRange${i}`] = {
            type: 'box',
            xMin: i - 0.4, // Adjust to align with the bar width
            xMax: i + 0.4, // Adjust to align with the bar width
            yMin: range[0],
            yMax: range[1],
            backgroundColor: 'rgba(0, 0, 0, 0.0)', // transparent
            borderWidth: 1,
            borderColor: '#0067A588',
        };
    });

    if (testName == "Basophils") {
        console.log("basophils", testData)
        console.log(dates)
        console.log(results)
        console.log(normalcy)
        console.log(ranges)
    }

    datasets = []
    if (results.filter((item, i) => item >= rangesNum[i][0] && item <= rangesNum[i][1] && normalcy[i] == '').length > 0)
        datasets.push({
            label: 'Normal',
            data: results.map((item, i) => item >= rangesNum[i][0] && item <= rangesNum[i][1] && normalcy[i] == '' ? item : null),
            borderColor: 'rgba(0, 0, 0, 1)',
            backgroundColor: '#00A86B88',
            borderWidth: 2,
        });

    if (results.filter((item, i) => (item < rangesNum[i][0] || item > rangesNum[i][1]) && normalcy[i] != '').length > 0)
        datasets.push({
            label: 'Abnormal',
            data: results.map((item, i) => (item < rangesNum[i][0] || item > rangesNum[i][1]) && normalcy[i] != '' ? item : null),
            borderColor: 'rgba(0, 0, 0, 1)',
            backgroundColor: '#FFBF0088',
            borderWidth: 2,
        });

    if (results.filter((item, i) => (item < rangesNum[i][0] || item > rangesNum[i][1]) && normalcy[i] == '').length > 0)
        datasets.push({
            label: 'Unmarked Abnormal',
            data: results.map((item, i) => (item < rangesNum[i][0] || item > rangesNum[i][1]) && normalcy[i] == '' ? item : null),
            borderColor: 'rgba(0, 0, 0, 1)',
            backgroundColor: '#FF2E98', //pink
            borderWidth: 2,
        });

    if (results.filter((item, i) => (Number.isNaN(rangesNum[i][0]) || Number.isNaN(rangesNum[i][1])) && item > 0 && normalcy[i] == '').length > 0)
        datasets.push({
            label: 'No reference range',
            // filter data for those without a reference range
            data: results.map((item, i) => Number.isNaN(rangesNum[i][0]) || Number.isNaN(rangesNum[i][1]) ? item : null),
            borderColor: 'rgba(0, 0, 0, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderWidth: 2,
        });

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: dates,
            datasets: datasets,
        },
        options: {
            responsive: true,
            scales: {
                x: { type: 'category' }, // Treat dates as categories
                y: { beginAtZero: true }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom' // legend position
                },
                title: {
                    display: true,
                    text: testName
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    stacked: true,
                },
                y: {
                    stacked: true
                }
            }
        }
    });
}

// Parse the uploaded HTML file
document.getElementById('uploadHtml').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function () {
        const parser = new DOMParser();
        const doc = parser.parseFromString(reader.result, 'text/html');

        // Extract table data (modify selectors based on your input HTML structure)
        const rows = Array.from(doc.querySelectorAll("table tr[colspan='5']")).map(tr =>
            Array.from(tr.querySelectorAll('td, th')).map(cell => cell.textContent.trim())
        );
        // Map rows 
        const filteredRows = rows.map((v, i) => {
            var spl = v[1].split(';')
            if (spl.length > 1) {
                v[1] = spl[0]
                v.push(spl[1])
            } else {
                v.push('')
            }
            if (spl.length > 2) {
                console.log("NOTICE - ")
                console.log(spl)
            }
            if (v.length === 6) {
                v = v.slice(0, 4).concat(['']).concat(v.slice(4, v.length))
            }
            if (v.length < 7) {
                for (let i = v.length; i < 7; i++) {
                    v.push('')
                }
            }
            return v
        });

        // Update the table and chart with the parsed data
        updateTable(filteredRows);
        // updateChart(filteredRows);
        // Group by test name
        const groupedData = groupByTestName(filteredRows);

        // Generate a chart for each test
        Object.keys(groupedData).forEach(testName => {
            createChartForTest(testName, groupedData[testName]);
        });
    };

    reader.readAsText(file);
});


function isValidDateTimeFormat(text) {
    const dateTimeRegex = /^\d{4}-\d{2}-\d{2}/;
    return text && text.length >= 10 && dateTimeRegex.test(text.substring(0, 10));
}

function isValidNumber(text) {
    const numberRegex = /^-?\d+(\.\d+)?$/;
    return numberRegex.test(text);
}

function formatDate(dateTimeString) {
    // Trim whitespace and split the string into date and time
    const trimmedString = dateTimeString.trim();
    const [date, time, gmt] = trimmedString.split(' ');

    // Format the output
    return date;
}
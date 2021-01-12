var timeFormat = 'YYYY/MM/DD';
var ctx = document.getElementById('mychart');
let dataarr = [];
for (let i = 0; i < 30; i++){
    dataarr[29-i] = stockdata[i].endprice
};
let lablearr = [];
for (let i = 0; i < 30; i++){
    lablearr[29-i] = stockdata[i].date
};

var myChart = new Chart(ctx, {
// The type of chart we want to create
type: 'line',

// The data for our dataset
    data: {
        labels: lablearr,
        datasets: [{
            label: 'Price',
            data: dataarr,
            borderColor: [
                '#0000ff'
            ],
            backgroundColor: [
                '#ccccff'
            ],
            borderWidth: 1,
            pointRadius:0
        }]
    },

    // Configuration options go here
    options: {
        responsive: false,
        animation: {
            animateScale: true
        },
        title: {
            display: true,
            text: "STOCK PRICE"
        },
        scales: {
            x: {
                type: 'time',
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Date'
                },
                ticks: {
                    major: {
                        enabled: true
                    }
                }
            },
            y: {
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'value'
                }
            }
        }
        
    }
});

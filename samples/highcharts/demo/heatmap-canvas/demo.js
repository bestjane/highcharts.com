$(function () {

    (function (H) {
        var wrap = H.wrap,
        seriesTypes = H.seriesTypes;

        /**
         * Recursively builds a K-D-tree 
         */
        function KDTree(points, depth) {
            var axis, median, length = points && points.length;

            if (length) {

                // alternate between the axis
                axis = ['plotX', 'plotY'][depth % 2];

                // sort point array
                points.sort(function(a, b) {
                    return a[axis] - b[axis];
                });
               
                median = Math.floor(length / 2);
                
                // build and return node
                return {
                    point: points[median],
                    left: KDTree(points.slice(0, median), depth + 1),
                    right: KDTree(points.slice(median + 1), depth + 1)
                };
            
            }
        }

        /**
         * Recursively searches for the nearest neighbour using the given K-D-tree
         */
        function nearest(search, tree, depth) {
            var point = tree.point,
                axis = ['plotX', 'plotY'][depth % 2],
                tdist,
                sideA,
                sideB,
                ret = point,
                nPoint1,
                nPoint2;
            
            // Get distance
            point.dist = Math.pow(search.plotX - point.plotX, 2) + 
                Math.pow(search.plotY - point.plotY, 2);
            
            // Pick side based on distance to splitting point
            tdist = search[axis] - point[axis];
            sideA = tdist < 0 ? 'left' : 'right';

            // End of tree
            if (tree[sideA]) {
                nPoint1 = nearest(search, tree[sideA], depth + 1);

                ret = (nPoint1.dist < ret.dist ? nPoint1 : point);

                sideB = tdist < 0 ? 'right' : 'left';
                if (tree[sideB]) {
                    // compare distance to current best to splitting point to decide wether to check side B or not
                    if (Math.abs(tdist) < ret.dist) {
                        nPoint2 = nearest(search, tree[sideB], depth + 1);
                        ret = (nPoint2.dist < ret.dist ? nPoint2 : ret);
                    }
                }
            }
            return ret;
        }

        // Extend the heatmap to use the K-D-tree to search for nearest points
        H.seriesTypes.heatmap.prototype.setTooltipPoints = function () {
            var series = this;

            this.tree = null;
            setTimeout(function () {
                series.tree = KDTree(series.points, 0);
            });
        };
        H.seriesTypes.heatmap.prototype.getNearest = function (search) {
            if (this.tree) {
                return nearest(search, this.tree, 0);
            }
        };

        H.wrap(H.Pointer.prototype, 'runPointActions', function (proceed, e) {
            var chart = this.chart;
            proceed.call(this, e);

            // Draw independent tooltips
            H.each(chart.series, function (series) {
                var point;
                if (series.getNearest) {
                    point = series.getNearest({ 
                        plotX: e.chartX - chart.plotLeft, 
                        plotY: e.chartY - chart.plotTop
                    });
                    if (point) {
                        point.onMouseOver(e);
                    }
                }
            })
        });

        /**
         * Get the canvas context for a series 
         */
        H.Series.prototype.getContext = function () {
            var canvas;
            if (!this.ctx) {
                canvas = document.createElement('canvas');
                canvas.setAttribute('width', this.chart.chartWidth);
                canvas.setAttribute('height', this.chart.chartHeight);
                canvas.style.position = 'absolute';
                canvas.style.left = 0;
                canvas.style.top = 0;
                canvas.style.zIndex = 0;
                canvas.style.cursor = 'crosshair';
                this.chart.container.appendChild(canvas);
                if (canvas.getContext) {
                    this.ctx = canvas.getContext('2d');
                    this.ctx.translate(this.group.translateX, this.group.translateY)
                }
            }
            return this.ctx;
        }

        /**
         * Wrap the drawPoints method to draw the points in canvas instead of the slower SVG, 
         * that requires one shape each point.
         */
        H.wrap(H.seriesTypes.heatmap.prototype, 'drawPoints', function (proceed) {

            var ctx = this.getContext();

            if (ctx) {
                
                // draw the columns
                H.each(this.points, function (point) {
                    var plotY = point.plotY,
                        shapeArgs;

                    if (plotY !== undefined && !isNaN(plotY) && point.y !== null) {
                        shapeArgs = point.shapeArgs;
                        
                        ctx.fillStyle = point.pointAttr[''].fill;
                        ctx.fillRect(shapeArgs.x, shapeArgs.y, shapeArgs.width, shapeArgs.height);
                    }
                });
            
            } else {
                this.chart.showLoading("Your browser doesn't support HTML5 canvas, <br>please use a modern browser");
                
                // Uncomment this to provide low-level (slow) support in oldIE. It will cause script errors on 
                // charts with more than a few thousand points.
                //proceed.call(this);
            }
        });
    }(Highcharts));


    var start;
    $('#container').highcharts({
        
        data: {
            csv: document.getElementById('csv').innerHTML,
            parsed: function () {
                start = +new Date();
            }
        },

        chart: {
            type: 'heatmap',
            margin: [50, 10, 80, 50]
        },


        title: {
            text: 'Highcharts extended heat map',
            align: 'left',
            x: 40
        },

        subtitle: {
            text: 'Temperature variation by day and hour through 2013',
            align: 'left',
            x: 40
        },

        tooltip: {
            backgroundColor: null,
            borderWidth: 0,
            distance: 10,
            shadow: false,
            useHTML: true,
            style: {
                padding: 0
            }
        },

        xAxis: {
            min: Date.UTC(2013, 0, 1),
            max: Date.UTC(2014, 0, 1),
            labels: {
                align: 'left',
                x: 5,
                format: '{value:%B}' // long month
            },
            showLastLabel: false,
            tickLength: 16
        },

        yAxis: {
            title: {
                text: null
            },
            labels: {
                format: '{value}:00'
            },
            minPadding: 0,
            maxPadding: 0,
            startOnTick: false,
            endOnTick: false,
            tickPositions: [0, 6, 12, 18, 24],
            tickWidth: 1,
            min: 0,
            max: 23,
            reversed: true
        },

        colorAxis: {
            stops: [
                [0, '#3060cf'],
                [0.5, '#fffbbc'],
                [0.9, '#c4463a'],
                [1, '#c4463a']
            ],
            min: -15,
            max: 25,
            startOnTick: false,
            endOnTick: false,
            labels: {
                format: '{value}℃'
            }
        },

        series: [{
            borderWidth: 0,
            nullColor: '#EFEFEF',
            colsize: 24 * 36e5, // one day
            tooltip: {
                headerFormat: 'Temperature<br/>',
                pointFormat: '{point.x:%e %b, %Y} {point.y}:00: <b>{point.value} ℃</b>'
            }
        }]

    });
    console.log('Rendered in ' + (new Date() - start) + ' ms');

});
var pymChild = null,
    mobileThreshold = 500, //set to 500 for testing
    aspect_width = 4,
    aspect_height = 10;

var $map = $('#map');

var margin = {
    top: 10,
    right: 10,
    bottom: 10,
    left: 20
};

var circleSize = 70;

var colors = {
    'red1': '#6C2315', 'red2': '#A23520', 'red3': '#D8472B', 'red4': '#E27560', 'red5': '#ECA395', 'red6': '#F5D1CA',
    'orange1': '#714616', 'orange2': '#AA6A21', 'orange3': '#E38D2C', 'orange4': '#EAAA61', 'orange5': '#F1C696', 'orange6': '#F8E2CA',
    'yellow1': '#77631B', 'yellow2': '#B39429', 'yellow3': '#EFC637', 'yellow4': '#F3D469', 'yellow5': '#F7E39B', 'yellow6': '#FBF1CD',
    'teal1': '#0B403F', 'teal2': '#11605E', 'teal3': '#17807E', 'teal4': '#51A09E', 'teal5': '#8BC0BF', 'teal6': '#C5DFDF',
    'blue1': '#28556F', 'blue2': '#3D7FA6', 'blue3': '#51AADE', 'blue4': '#7DBFE6', 'blue5': '#A8D5EF', 'blue6': '#D3EAF7'
};

/*
 * Render the graphic
 */
//check for svg
function draw_graphic(){
    if (Modernizr.svg){
        $map.empty();
        var width = $map.width();
        render(width);
        window.onresize = draw_graphic; //very important! the key to responsiveness
    }
}


function render(width) {
    //leaflet stuff

    var map = new L.Map("map", {center: [-124.19, 41.92], zoom: 4})
        .addLayer(new L.TileLayer("http://{s}.tiles.mapbox.com/v3/examples.map-vyofok3q/{z}/{x}/{y}.png"));

    var svg = d3.select(map.getPanes().overlayPane).append("svg"),
        g = svg.append("g").attr("class", "leaflet-zoom-hide");

    d3.json("us-states.json", function(collection){
        //code

        //geo transform
        function projectPoint(x, y) {
            var point = map.latLngToLayerPoint(new L.LatLng(y, x));
            this.stream.point(point.x, point.y);
        }

        //create a path to convert geojson to svg
        var transform = d3.geo.transform({point: projectPoint}),
            path = d3.geo.path().projection(transform);

        //data join to create paths for each feature
        var feature = g.selectAll("path")
                .data(collection.features)
            .enter().append("path");

        //initialize the path data by setting d
        feature.attr("d", path);

        //project bounding box
        var bounds = path.bounds(collection),
            topLeft = bounds[0],
            bottomRight = bounds[1];

        //set svg position
        svg.attr("width", bottomRight[0] - topLeft[0])
            .attr("height", bottomRight[1] - topLeft[1])
            .style("left", topLeft[0] + "px")
            .style("top", topLeft[1] + "px");
        g.attr("transform", "translate(" + -topLeft[0] + "," + -topLeft[1] + ")");
    })





    // d3 stuff

    var height = .88 * width;

    var circleSize = 0.065 * width;

    var  projection = d3.geo.mercator()
        .scale(width*4)
        .center([-124.19, 41.92]) //exact upper left of california according to latlong.net
        .translate([margin.left,margin.top]);

    var path = d3.geo.path()
        .projection(projection);

    var svg = d3.select("#map").append("svg")
        .attr("width", width)
        .attr("height", height);

    //global for console
    var myObj = {};

    queue()
        .defer(d3.json, "counties.json")
        .defer(d3.csv, "flu_percent_unused2.csv")
        .defer(d3.csv, "2013_county.csv")
        .await(ready);

    var fluByCounty = {};
    var vacByCounty = {};

    function ready(error, ca, flu, pop){
        //maps county names to flu percentage
        flu.forEach(function(d) { 
            fluByCounty[d.county] = +d.percent_unused;});
        
        //map county names to average vaccines
         flu.forEach(function(d) {
            vacByCounty[d.county] = +d.total;});

        mapData = topojson.feature(ca, ca.objects.subunits);
        
        //max for color scale
        var max = d3.max(flu, function(d) { return +d.percent_unused; });

        //threshold scale for key and circles
        var color = d3.scale.threshold() //colorscale
            .domain([.1, .2, .3, .4])
            .range(colorbrewer.Blues[4]);
            
        //attach data to circle areas
        var areas = mapData.features.map(
            function(d) {return vacByCounty[d.properties.name];})

        //scale for circle
        var scale = d3.scale.sqrt()
            .domain(d3.extent(areas))
            .range([4, circleSize]);

        //draw county shapes
        svg.selectAll(".subunit")
              .data(mapData.features)
            .enter().append("path")
            .attr("class", function(d) { return "subunit " + d.properties.name; })
            .attr("d", path);
              // // get color from csv call
              // .style("fill", function(d){ 
              //   return color(fluByCounty[d.properties.name]);
        
              // });

        //exterior border
        svg.append("path")
            .datum(topojson.mesh(ca, ca.objects.subunits, function(a, b) { return a === b;}))
            .attr("d", path)
            .attr("class", "exterior-boundary");

        //tooltip declaration
        var div = d3.select("#map").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);

        //format for tooltip
        var percentFormat = function(d){
            if (d) { return (d3.format(".1%"))(d) }
            else { return "N/A"}
            }

        //circles
        svg.append("g")
              .attr("class", "circles")
            .selectAll("circle")
                  .data(topojson.feature(ca, ca.objects.subunits).features)
                .enter().append("circle")
                    .attr("transform", function(d) { return 'translate(' + path.centroid(d) + ')';})
                  .attr("r", function(d) { return scale(vacByCounty[d.properties.name]); })
            .style("fill", function(d){ 
                return color(fluByCounty[d.properties.name]);
              })
                .on("mouseover", function(d){ //tooltip
                    div.transition()
                        .duration(200)
                        .style("opacity", .9);
                    div.html(d.properties.fullName + "<p>% Unused: " + percentFormat(fluByCounty[d.properties.name]) + "</p><p># Vaccines Available: " + vacByCounty[d.properties.name] + "</p>"

                    )
                        .style("left", (d3.event.pageX) + 10 + "px")
                        .style("top", (d3.event.pageY - 30) + "px"); 
                })
                .on("mouseout", function(d) { 
                    div.transition()
                        .duration(500)
                        .style("opacity", 0.0);
                });        

    //key position encoding for legend
    var y = d3.scale.linear()
        .domain([0, max]) //input data
        .range([0, width/4]); //height of the key


    //create group for color bar and append data
    var colorBar = svg.append("g")
        .attr("class", "key")
        .attr("transform", "translate(" + (.4 * width) + "," + margin.top * 2 + ")") //position w/in svg
        .selectAll("rect")
        .data(color.range().map(function(col) {
            var d = color.invertExtent(col);
            if (d[0] == null) d[0] = y.domain()[0];
            if (d[1] == null) d[1] = y.domain()[1];
            return d;
        }));


    //create color rects
    colorBar.enter()
        .append("rect")
            .attr("width", 15)
            .attr("y", function(d) { 
                return y(d[0]); })
            .attr("height", function(d) { return y(d[1]) - y(d[0]); })
            .attr("fill", function(d) { return color(d[0]); });

    //get array of legend domain
    var colorDomain = color.domain();

    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("right")
        .tickSize(16)
        .tickValues([colorDomain[0], colorDomain[1], colorDomain[2], colorDomain[3]])
        .tickFormat(percentFormat);

    //console.log(format(max));

    //add label
    d3.select(".key")
        .call(yAxis)
        .append("text")
        .attr("y", -5)
        .attr("class", "label")
        .text("Percent of Vaccine Left Over")
        ;
    //end of ready function
    }

    //send height to parent AFTER chart is built
    if (pymChild) {
        pymChild.sendHeightToParent();
    }

//end function render    
}
/*
 * NB: Use window.load instead of document.ready
 * to ensure all images have loaded
 */
$(window).load(function() {
    if (Modernizr.svg){
        pymChild = new pym.Child({
            renderCallback: draw_graphic()
        });
    }
    else { pymChild = new pym.Child();
    }
})







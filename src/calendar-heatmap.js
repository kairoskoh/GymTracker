'use strict';

/* globals d3 */

var calendarHeatmap = {

  settings: {
    gutter: 5,
    item_gutter: 1,
    width: 1000,
    height: 200,
    item_size: 10,
    label_padding: 40,
    max_block_height: 20,
    transition_duration: 500,
    tooltip_width: 250,
    tooltip_padding: 15,
  },


  /**
   * Initialize
   */
  init: function(data, container, color, overview, handler) {
    // Set calendar data
    calendarHeatmap.data = data;

    // Set calendar container
    calendarHeatmap.container = container;

    // Set calendar color
    calendarHeatmap.color = color || '#ff4500';

    // Initialize current overview type and history
    calendarHeatmap.overview = overview;
    calendarHeatmap.history = ['global'];
    calendarHeatmap.selected = {};

    // Set handler function
    calendarHeatmap.handler = handler;

    // No transition to start with
    calendarHeatmap.in_transition = false;

    // Create html elementsfor the calendar
    calendarHeatmap.createElements();

    // Parse data for summary details
    // calendarHeatmap.parseData();

    // Draw the chart
    calendarHeatmap.drawYearOverview();
  },


  /**
   * Create html elements for the calendar
   */
  createElements: function() {
    if (calendarHeatmap.container != null) {
      // Access container for calendar
      var container = document.getElementById(calendarHeatmap.container);
      if (!container || container.tagName != "DIV") {
        throw 'Element not found or not of type div';
      }
      if (!container.classList.contains('calendar-heatmap')) {
        //If the element being passed doesn't have the right class set then set it.
        container.classList.add('calendar-heatmap');
      }
    } else {
      // Create main html container for the calendar
      var container = document.createElement('div');
      container.className = 'calendar-heatmap';
      document.body.appendChild(container);
    }

    // Create svg element
    var svg = d3.select(container).append('svg')
      .attr('class', 'svg');

    // Create other svg elements
    calendarHeatmap.items = svg.append('g');
    calendarHeatmap.labels = svg.append('g');
    calendarHeatmap.buttons = svg.append('g');

    // Add tooltip to the same element as main svg
    calendarHeatmap.tooltip = d3.select(container).append('div')
      .attr('class', 'heatmap-tooltip')
      .style('opacity', 0);

    // Calculate dimensions based on available width
    var calcDimensions = function() {

      var dayIndex = Math.round((moment() - moment().subtract(1, 'year').startOf('week')) / 86400000);
      var colIndex = Math.trunc(dayIndex / 7);
      var numWeeks = colIndex + 1;

      calendarHeatmap.settings.width = container.offsetWidth < 1000 ? 1000 : container.offsetWidth;
      calendarHeatmap.settings.item_size = ((calendarHeatmap.settings.width - calendarHeatmap.settings.label_padding) / numWeeks - calendarHeatmap.settings.gutter);
      calendarHeatmap.settings.height = calendarHeatmap.settings.label_padding + 7 * (calendarHeatmap.settings.item_size + calendarHeatmap.settings.gutter);
      svg.attr('width', calendarHeatmap.settings.width)
        .attr('height', calendarHeatmap.settings.height);

      // if (!!calendarHeatmap.data && !!calendarHeatmap.data[0].summary) {
      //   calendarHeatmap.drawYearOverview();
      // }
      calendarHeatmap.drawYearOverview();
    };
    calcDimensions();

    window.onresize = function(event) {
      calcDimensions();
    };
  },


  /**
   * Parse data for summary in case it was not provided
   */
  parseData: function() {
    if (!calendarHeatmap.data) { return; }

    // Get daily summary if that was not provided
    if (!calendarHeatmap.data[0].summary) {
      calendarHeatmap.data.map(function(d) {
        var summary = d.details.reduce(function(uniques, project) {
          if (!uniques[project.name]) {
            uniques[project.name] = {
              'value': project.value
            };
          } else {
            uniques[project.name].value += project.value;
          }
          return uniques;
        }, {});
        var unsorted_summary = Object.keys(summary).map(function(key) {
          return {
            'name': key,
            'value': summary[key].value
          };
        });
        d.summary = unsorted_summary.sort(function(a, b) {
          return b.value - a.value;
        });
        return d;
      });
    }
  },

  /**
   * Draw year overview
   */
  drawYearOverview: function() {
    // Add current overview to the history
    if (calendarHeatmap.history[calendarHeatmap.history.length - 1] !== calendarHeatmap.overview) {
      calendarHeatmap.history.push(calendarHeatmap.overview);
    }

    // Define start and end date of the selected year
    var start_of_year = $("#startDate").datepicker("getDate");
    var end_of_year = $("#endDate").datepicker("getDate");
    // var start_of_year = moment(calendarHeatmap.selected.date).startOf('year');
    // var end_of_year = moment(calendarHeatmap.selected.date).endOf('year');

    // Filter data down to the selected year
    var year_data = calendarHeatmap.data.filter(function(d) {
      return start_of_year <= moment(d.date) && moment(d.date) < end_of_year;
    });
    // var year_data = calendarHeatmap.data.filter(function(d) {
    //   var currentDate = moment(d.date);
    //   return currentDate.isSameOrAfter(start_of_year) && currentDate.isBefore(end_of_year);
    // });

    // Calculate max value of the year data
    var max_value = d3.max(year_data, function(d) {
      return d.total;
    });

    var color = d3.scaleLinear()
      .range(['#ffffff', calendarHeatmap.color || '#ff4500'])
      .domain([-0.15 * max_value, max_value]);

    var calcItemX = function(d) {
      var date = moment(d.date);
      var dayIndex = Math.round((date - moment(start_of_year).startOf('week')) / 86400000);
      var colIndex = Math.trunc(dayIndex / 7);
      return colIndex * (calendarHeatmap.settings.item_size + calendarHeatmap.settings.gutter) + calendarHeatmap.settings.label_padding;
    };
    var calcItemY = function(d) {
      return calendarHeatmap.settings.label_padding + moment(d.date).weekday() * (calendarHeatmap.settings.item_size + calendarHeatmap.settings.gutter);
    };
    var calcItemSize = function(d) {
      return calendarHeatmap.settings.item_size;
      // NOTE: change individual day size here
      // if (max_value <= 0) { return calendarHeatmap.settings.item_size; }
      // return calendarHeatmap.settings.item_size * 0.75 + (calendarHeatmap.settings.item_size * d.total / max_value) * 0.25;
    };

    var allDaysInRange = [];
    var currentDate = moment(start_of_year);

    // Create an array containing all days between start_of_year and end_of_year
    while (currentDate.isSameOrBefore(end_of_year)) {
      allDaysInRange.push(currentDate.clone());
      currentDate.add(1, 'day');
    }

    calendarHeatmap.items.selectAll('.item-circle').remove();
    calendarHeatmap.items.selectAll('.item-circle')
      .data(year_data)
      .enter()
      .append('rect')
      .attr('class', 'item item-circle')
      .style('opacity', 0)
      .attr('x', function(d) {
        return calcItemX(d) + (calendarHeatmap.settings.item_size - calcItemSize(d)) / 2;
      })
      .attr('y', function(d) {
        return calcItemY(d) + (calendarHeatmap.settings.item_size - calcItemSize(d)) / 2;
      })
      .attr('rx', function(d) {
        return calcItemSize(d);
      })
      .attr('ry', function(d) {
        return calcItemSize(d);
      })
      .attr('width', function(d) {
        return calcItemSize(d);
      })
      .attr('height', function(d) {
        return calcItemSize(d);
      })
      .attr('fill', function(d) {
        // NOTE: change individual day color here
        return (d.total > 0) ? color(d.total) : 'grey';
        // return (d.total > 0) ? '#3CB043' : 'grey';
      })
      .on('click', function(d) {
        // if (calendarHeatmap.in_transition) { return; }

        // // Don't transition if there is no data to show
        // if (d.total === 0) { return; }

        // calendarHeatmap.in_transition = true;

        // // Set selected date to the one clicked on
        // calendarHeatmap.selected = d;

        // // Hide tooltip
        // calendarHeatmap.hideTooltip();
        if (calendarHeatmap.in_transition) { return; }
        alert(d.date);
      })
      .transition()
      .delay(function() {
        return (Math.cos(Math.PI * Math.random()) + 1) * calendarHeatmap.settings.transition_duration;
      })
      .duration(function() {
        return calendarHeatmap.settings.transition_duration;
      })
      .ease(d3.easeLinear)
      .style('opacity', 1)
      .call(function(transition, callback) {
        if (transition.empty()) {
          callback();
        }
        var n = 0;
        transition
          .each(function() {++n; })
          .on('end', function() {
            if (!--n) {
              callback.apply(this, arguments);
            }
          });
      }, function() {
        calendarHeatmap.in_transition = false;
      });

    // Add month labels
    var start_of_month = new Date(start_of_year.getFullYear(), start_of_year.getMonth(), 1);
    var month_labels = d3.timeMonths(start_of_month, end_of_year);
    var monthScale = d3.scaleLinear()
      .range([0, calendarHeatmap.settings.width])
      .domain([0, month_labels.length]);
    calendarHeatmap.labels.selectAll('.label-month').remove();
    calendarHeatmap.labels.selectAll('.label-month')
      .data(month_labels)
      .enter()
      .append('text')
      .attr('class', 'label label-month')
      .attr('font-size', function() {
        return Math.floor(calendarHeatmap.settings.label_padding / 3) + 'px';
      })
      .text(function(d) {
        // NOTE: to remove month labels to just 3 letter month form
        // return d.toLocaleDateString('en-us', { month: 'short' });
        var monthName = d.toLocaleDateString('en-us', { month: 'short' });
        var year = d.getFullYear().toString().slice(-2); // Extract last two digits
        return monthName + " " + year; // Format: Dec'YY
      })
      .attr('x', function(d, i) {
        return monthScale(i) + (monthScale(i) - monthScale(i - 1)) / 2;
      })
      .attr('y', calendarHeatmap.settings.label_padding / 2)
      .on('mouseenter', function(d) {
        if (calendarHeatmap.in_transition) { return; }

        var selected_month = moment(d);
        calendarHeatmap.items.selectAll('.item-circle')
          .transition()
          .duration(calendarHeatmap.settings.transition_duration)
          .ease(d3.easeLinear)
          .style('opacity', function(d) {
            return moment(d.date).isSame(selected_month, 'month') ? 1 : 0.1;
          });
      })
      .on('mouseout', function() {
        if (calendarHeatmap.in_transition) { return; }

        calendarHeatmap.items.selectAll('.item-circle')
          .transition()
          .duration(calendarHeatmap.settings.transition_duration)
          .ease(d3.easeLinear)
          .style('opacity', 1);
      })
      .on('click', function(d) {
        if (calendarHeatmap.in_transition) { return; }

        // Check month data
        var month_data = calendarHeatmap.data.filter(function(e) {
          return moment(d).startOf('month') <= moment(e.date) && moment(e.date) < moment(d).endOf('month');
        });

        // Don't transition if there is no data to show
        if (!month_data.length) { return; }

        // Set selected month to the one clicked on
        calendarHeatmap.selected = { date: d };

        calendarHeatmap.in_transition = true;

        // Hide tooltip
        calendarHeatmap.hideTooltip();

        // Redraw the chart
        calendarHeatmap.overview = 'month';
        calendarHeatmap.drawChart();
      });

    // Add day labels
    var day_labels = d3.timeDays(moment().startOf('week'), moment().endOf('week'));
    var dayScale = d3.scaleBand()
      .rangeRound([calendarHeatmap.settings.label_padding, calendarHeatmap.settings.height])
      .domain(day_labels.map(function(d) {
        return moment(d).weekday();
      }));
    calendarHeatmap.labels.selectAll('.label-day').remove();
    calendarHeatmap.labels.selectAll('.label-day')
      .data(day_labels)
      .enter()
      .append('text')
      .attr('class', 'label label-day')
      .attr('x', calendarHeatmap.settings.label_padding / 3)
      .attr('y', function(d, i) {
        return dayScale(i) + dayScale.bandwidth() / 1.75;
      })
      .style('text-anchor', 'left')
      .attr('font-size', function() {
        return Math.floor(calendarHeatmap.settings.label_padding / 3) + 'px';
      })
      .text(function(d) {
        return moment(d).format('dddd')[0];
      })
      .on('mouseenter', function(d) {
        if (calendarHeatmap.in_transition) { return; }

        var selected_day = moment(d);
        calendarHeatmap.items.selectAll('.item-circle')
          .transition()
          .duration(calendarHeatmap.settings.transition_duration)
          .ease(d3.easeLinear)
          .style('opacity', function(d) {
            return (moment(d.date).day() === selected_day.day()) ? 1 : 0.1;
          });
      })
      .on('mouseout', function() {
        if (calendarHeatmap.in_transition) { return; }

        calendarHeatmap.items.selectAll('.item-circle')
          .transition()
          .duration(calendarHeatmap.settings.transition_duration)
          .ease(d3.easeLinear)
          .style('opacity', 1);
      });
  },

  /**
   * Helper function to hide the tooltip
   */
  hideTooltip: function() {
    calendarHeatmap.tooltip.transition()
      .duration(calendarHeatmap.settings.transition_duration / 2)
      .ease(d3.easeLinear)
      .style('opacity', 0);
  },


  /**
   * Helper function to convert seconds to a human readable format
   * @param seconds Integer
   */
  formatTime: function(seconds) {
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds - (hours * 3600)) / 60);
    var time = '';
    if (hours > 0) {
      time += hours === 1 ? '1 hour ' : hours + ' hours ';
    }
    if (minutes > 0) {
      time += minutes === 1 ? '1 minute' : minutes + ' minutes';
    }
    if (hours === 0 && minutes === 0) {
      time = Math.round(seconds) + ' seconds';
    }
    return time;
  },

};

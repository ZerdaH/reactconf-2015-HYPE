// Utilities first, Backbone stuff is further down

// log the average time each render takes
var start = Date.now();
var allTime = 0;
var updates = 0;
var avgTime = 0;
var timerEl = document.getElementById("timerEl");
function logTime(elapsed) {
  allTime += elapsed;
  avgTime = allTime / ++updates;
  timerEl.textContent = Math.floor(avgTime);
}

function getData() {
  // generate some dummy data
  var data = {
    start_at: new Date().getTime() / 1000,
    databases: {}
  };

  for (var i = 1; i <= ENV.rows; i++) {
    data.databases["cluster" + i] = {
      queries: []
    };

    data.databases["cluster" + i + "slave"] = {
      queries: []
    };
  }

  Object.keys(data.databases).forEach(function(dbname) {
    var info = data.databases[dbname];

    var r = Math.floor((Math.random() * 10) + 1);
    for (var i = 0; i < r; i++) {
      var q = {
        canvas_action: null,
        canvas_context_id: null,
        canvas_controller: null,
        canvas_hostname: null,
        canvas_job_tag: null,
        canvas_pid: null,
        elapsed: Math.random() * 15,
        query: "SELECT blah FROM something",
        waiting: Math.random() < 0.5
      };

      if (Math.random() < 0.2) {
        q.query = "<IDLE> in transaction";
      }

      if (Math.random() < 0.1) {
        q.query = "vacuum";
      }

      info.queries.push(q);
    }

    info.queries = info.queries.sort(function(a, b) {
      return b.elapsed - a.elapsed;
    });
  });

  return data;
}

function formatElapsed(value) {
  if (value) {
    var str = parseFloat(value).toFixed(2);

    if (value > 60) {
      var minutes = Math.floor(value / 60);
      var comps = (value % 60).toFixed(2).split('.');
      var seconds = comps[0].lpad('0', 2);
      var ms = comps[1];
      str = minutes + ":" + seconds + "." + ms;
    }

      return str;

  } else {
    return null;
  }
}

function getTopFiveQueries(queries) {
  var topFiveQueries = queries.slice(0, 5);

  while (topFiveQueries.length < 5) {
    topFiveQueries.push({query: ""});
  }

  return topFiveQueries;
}

function getCountClassName(count) {
  if (count >= 20) {
    return 'label-important';

  } else if (count >= 10) {
    return 'label-warning';

  } else {
    return 'label-success';
  }
}

function getElapsedClassName(elapsed) {
  if (elapsed >= 10.0) {
    return 'warn_long';

  } else if (elapsed >= 1.0) {
    return 'warn';

  } else {
    return 'short';
  }
}


// Begin backbone specific stuff

var DBCollection = Backbone.Collection.extend({
  // have to parse the data each time to work with a backbone collection
  parse: function (data) {
    return _.map(data.databases, function (database, clusterName) {
      var cluster = database;
      cluster.id = clusterName;
      return cluster;
    });
  }
});

// Table wrapper view
var DBView = Backbone.View.extend({
  tagName: 'table',
  className: 'table table-striped latest-data',

  initialize: function () {
    this.render();
  },

  render: function () {
    this.$el.append('<tbody id="dbtbody"></tbody>');
    var $tbody = this.$('#dbtbody');

    this.collection.each(function (model) {
      var rowView = new DBRowView({model: model});
      $tbody.append(rowView.render().$el);
    });

    $('#dbmon').html(this.$el);
  }
});

// Row view
// I initially thought the popover used javascript,
// so I was going to add events for each row here.
// This is probably a bit overkill then,
// but at least we're now set up to re-render just each row
// if only that row's data changes.
var DBRowView = Backbone.View.extend({
  tagName: 'tr',

  initialize: function (options) {
    _.bindAll(this, 'render');
    this.listenTo(this.model, 'change', this.render);
  },

  render: function () {
    var queries = this.model.get('queries');
    var topFiveQueries = getTopFiveQueries(queries);

    this.$el.html(Mustache.render('<td class="dbname">{{dbName}}</td>' +
      '<td class="query-count">' +
        '<span class="label {{countClassName}}">{{count}}</span>' +
      '</td>' +
      '{{#queries}}' +
        '<td class="Query elapsed {{elapsedClassName}}">' +
          '<span>{{elapsed}}</span>' +
          '<div class="popover left">' +
            '<div class="popover-content">{{query}}</div>' +
            '<div class="arrow"></div>' +
          '</div>' +
        '</td>' +
      '{{/queries}}',
      {
        dbName:     this.model.id,
        count:      queries.length,
        countClassName: getCountClassName(queries.length),

        queries: _.map(topFiveQueries, function (query) {
          query.elapsedClassName = getElapsedClassName(query.elapsed);
          query.elapsed = formatElapsed(query.elapsed);
          return query;
        })
      }));

    return this;
  }
});


var dbCollection = new DBCollection(getData(), {parse: true});
var dbView = new DBView({collection: dbCollection});


setInterval(function () {
  var updateStart = Date.now();

  dbCollection.set(getData(), {parse: true});

  logTime(Date.now() - updateStart);
}, ENV.timeout);

document.getElementById("initTimeEl").textContent = Date.now() - start;
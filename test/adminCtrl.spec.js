describe("Unit Testing adminCtrl", function() {

  let ctrl;
  let sortKey;
  let reverse;
  let MAX_ACTIONS = 10;

  let mockActions = [
          {
              "_id": "59b3d655bb644f0c119e5f5f",
              "name": "What Could Go Wrong? Hire Zartan",
              "active": true,
              "value": 10,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f4a",
              "name": "Weather Dominator Strike!",
              "active": true,
              "value": 9,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f5b",
              "name": "Vance Wingfield Plots Overthrow",
              "active": true,
              "value": 8,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f4d",
              "name": "Time for the Night Vision Goggles",
              "active": true,
              "value": 7,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f53",
              "name": "T-11 Parachute",
              "active": true,
              "value": 6,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f38",
              "name": "Snake Eye's Uzi",
              "active": true,
              "value": 5,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f55",
              "name": "Smurfy Snake Eye's",
              "active": true,
              "value": 4,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
              "_id": "59b3d655bb644f0c119e5f39",
              "name": "Sidekick! Timber Joins",
              "active": true,
              "value": 3,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
            "_id": "59b3d655bb644f0c119e5f57",
            "name": "Red Rocket Franchise",
            "active": true,
            "value": 2,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          },
          {
            "_id": "59b3d655bb644f0c119e5f4e",
            "name": "PRC-117 Radios HQ",
            "active": true,
            "value": 1,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          }
        ];

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$log_,_$q_,_$interval_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $q = _$q_;
    $log = _$log_;
    $interval = _$interval_;

   getGameDataMock = {
      getUserId: function() {
            return "59b3d92a026d930c39bd9ed6";
      },
      getAllActions: function(callback) {
        var response = {};
        response.status = 200;
        response.data = mockActions;

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      createAction: function($index) {
        var response = [];
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      updateActionStatus: function(actionId, status) {
        for (var i = 0; i < ctrl.actions.length; i++) {
          if (ctrl.actions[i]['_id'] === actionId) {
            ctrl.actions[i]['active'] = (status === 'enable') ? true : false;
          }
        }
        var response = [];
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      updateActionValues: function() {
        var action =  {
              "_id": "59b3d655bb644f0c119e5f5f",
              "name": "What Could Go Wrong? Hire Zartan",
              "active": true,
              "value": 15,
              "bonuses": {
                  "city": 0,
                  "jungle": 0,
                  "desert": 0,
                  "extreme": -3,
                  "rain": 2,
                  "snow": -1
              }
          };

        ctrl.actions[0] = action;  

        var response = {};
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      },
      updateActionBonuses: function(actionId, action) {
        var response = [];
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      }
    }


    ctrl = $controller('adminCtrl', { $scope: $scope, $log: $log, $q: $q, $interval: $interval, dataService: getGameDataMock});

  }));

  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a adminCtrl', function() {
    expect(ctrl).to.not.be.undefined;
  });

  it('should verify getUserId service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.getUserId).to.exist;;
  }));

  it('should verify getAllActions service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.getAllActions).to.exist;;
  }));

  it('should verify createAction service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.createAction).to.exist;;
  }));

  it('should verify updateActionStatus service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.updateActionStatus).to.exist;;
  }));

  it('should verify updateActionValues service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.updateActionValues).to.exist;;
  }));

  it('should verify updateActionBonuses service exists', inject(function() {
    $scope.$digest();
    expect(getGameDataMock.updateActionBonuses).to.exist;;
  }));

  it('should set user', inject(function() {
    $scope.$digest();
    expect(ctrl.user).to.exist;
    expect(ctrl.user._id).to.equal('59b3d92a026d930c39bd9ed6');
  }));

  it('should get all actions', inject(function() {
    $scope.$digest();
    expect(ctrl.actions).to.exist;
    expect(ctrl.actions).to.have.lengthOf(10);
    expect(ctrl.actions[6]['name']).to.equal('Smurfy Snake Eye\'s');
  }));

  it('should set sortKey and reverse on sort()', inject(function() {
    $scope.$digest();
    expect(ctrl.sortKey).to.equal('name');
    ctrl.sort('value');
    expect(ctrl.sortKey).to.equal('value');
    expect(ctrl.reverse).to.equal(true);
  }));

  it('should modify action status', inject(function() {
    $scope.$digest();
    expect(ctrl.actions[0]['active']).to.equal(true);
    ctrl.actionStatus('59b3d655bb644f0c119e5f5f', 'disable', 0);
    expect(ctrl.actions[0]['active']).to.equal(false);
  }));

  it('should modify action values', inject(function() {
    $scope.$digest();
    expect(ctrl.actions[0]['value']).to.equal(10);
    ctrl.updateActionValues();
    expect(ctrl.actions[0]['value']).to.equal(15);
  }));

  it('should add action to actions array', inject(function() {
    $scope.$digest();
    expect(ctrl.actions).to.have.lengthOf(10);
    ctrl.addAction();
    expect(ctrl.actions).to.have.lengthOf(11);
  }));

  it('should create an action', inject(function() {
    $scope.$digest();
    // take blank action created in previous test
    expect(ctrl.actions[10]['name']).to.equal('');
    expect(ctrl.actions[10]['_id']).to.equal(undefined);

    // set values as on page
    ctrl.actions[10] = {
        "name": "Kwinn on the Scene",
        "__v": 0,
        "bonuses": {
            "city": 0,
            "jungle": 0,
            "desert": -3,
            "extreme": 5,
            "rain": -3,
            "snow": 5
        },
        "active": false
    }

    ctrl.saveAction(10);
    // no new action was created
    expect(ctrl.actions).to.have.lengthOf(11);
    expect(ctrl.actions[10]['active']).to.equal(false);
    // id would still be undefined since that is created at the database
    expect(ctrl.actions[10]['_id']).to.equal(undefined);
  }));

  it('should save an existing action', inject(function() {
    $scope.$digest();
    // take blank action created in previous test
    expect(ctrl.actions[1]['name']).to.equal('Weather Dominator Strike!');
    expect(ctrl.actions[1]['_id']).to.equal('59b3d655bb644f0c119e5f4a');

    // set values as on page
    ctrl.actions[1] = {
        "name": "Weather Dominator Strike!",
        "_id": "59b3d655bb644f0c119e5f4a",
        "__v": 0,
        "bonuses": {
            "city": 2,
            "jungle": 1,
            "desert": 3,
            "extreme": 4,
            "rain": 1,
            "snow": 5
        },
        "active": true
    }

    ctrl.saveAction(1);
    // no new action was created
    expect(ctrl.actions).to.have.lengthOf(11);
    expect(ctrl.actions[1]['active']).to.equal(true);
    expect(ctrl.actions[1]['_id']).to.equal('59b3d655bb644f0c119e5f4a');
    expect(ctrl.actions[1]['bonuses']['city']).to.equal(2);
  }));

  it('should return a validation error', inject(function() {
    $scope.$digest();
    expect(ctrl.actions).to.have.lengthOf(11);
    ctrl.addAction();
    expect(ctrl.actions).to.have.lengthOf(12);
    expect(ctrl.actions[11]['name']).to.equal('');
    ctrl.saveAction(11);
    expect(ctrl.errorMessage).to.have.lengthOf(1);
    expect(ctrl.errorMessage[0]).to.equal('Action name must be populated.');
  }));

  it('should return a validation error for max value', inject(function() {
    $scope.$digest();
    expect(ctrl.actions).to.have.lengthOf(12);
    expect(ctrl.actions[11]['name']).to.equal('');
    expect(ctrl.actions[11]['bonuses']['city']).to.equal(0);

    ctrl.actions[11]['name'] = 'Testing';
    ctrl.actions[11]['bonuses']['city'] = 21;
    ctrl.saveAction(11);
    expect(ctrl.errorMessage).to.have.lengthOf(1);
    expect(ctrl.errorMessage[0]).to.equal('Bonus value city must fall between -20 and 20.');
  }));

  it('should return a validation error on validateBonuses', inject(function() {
    $scope.$digest();
    expect(ctrl.validateBonuses(21)).to.equal('Value must fall between -20 and 20.');
    expect(ctrl.validateBonuses('f')).to.equal('Value must be a number.');
  }));

  it('should return validateBonuses with true', inject(function() {
    $scope.$digest();
    expect(ctrl.validateBonuses(5)).to.equal(true);
  }));

  it('should return a validation error on validateName', inject(function() {
    $scope.$digest();
    expect(ctrl.validateName()).to.equal('Name cannot be null.');
    expect(ctrl.validateName('')).to.equal('Name cannot be null.');
  }));

  it('should return validateName with true', inject(function() {
    $scope.$digest();
    expect(ctrl.validateName('Test name')).to.equal(true);
  }));

});
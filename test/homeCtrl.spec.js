describe("Unit Testing homeCtrl", function() {

  let getAllUsersMock;
  let ctrl;
  let sortKey;
  let reverse;

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$log_,_$q_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $log = _$log_;
    $q = _$q_;

   getAllUsersMock = {
      getAllUsers: function(callback) {
        var response = {};
        response.status = 200;
        response.data = [
            {
                "_id": "59b3d92a026d930c39bd9ed8",
                "email": "scottb@test.com",
                "name": "Scott B",
                "__v": 0,
                "results": {
                    "draws": 0,
                    "losses": 4,
                    "wins": 65
                },
                "achievements": [],
                "roles": [
                    "user"
                ]
            }
        ];

        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      }            
    }

    ctrl = $controller('homeCtrl', { $scope: $scope, dataService: getAllUsersMock});

  }));

  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a homeCtrl', function() {
    expect(ctrl).to.not.be.undefined;
  });

  it('should verify getAllUsers service exists', inject(function() {
    $scope.$digest();
    expect(getAllUsersMock.getAllUsers).to.exist;;
  }));

  it('should set sortKey and reverse on sort()', inject(function() {
    $scope.$digest();
    expect(ctrl.sortKey).to.equal(undefined);
    ctrl.sort('name');
    expect(ctrl.sortKey).to.equal('name');
    expect(ctrl.reverse).to.equal(true);
  }));

  it('should return float as string on returnPercentage()', inject(function() {
    var user = {};
    user.results = { wins: 10, losses: 2, draws: 0};
    $scope.$digest();
    expect(ctrl.returnPercentage(user)).that.is.a.number;
    expect(ctrl.returnPercentage(user)).to.equal('83.33');
  }));

  it('should set return users', inject(function() {
    $scope.$digest();
    expect(ctrl.users).to.have.lengthOf(1);
    expect(ctrl.users[0]['name']).to.equal('Scott B');
  }));

});
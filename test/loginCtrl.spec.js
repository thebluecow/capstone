describe("Unit Testing loginCtrl", function() {

  var loginForm = {};

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$location_, _$q_, _$httpBackend_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $location = _$location_;
    $q = _$q_;
    $httpBackend = _$httpBackend_;

   authServiceMock = {
      login: function(email, password) {
        var response = {};
        if (email !== undefined && email !== '') {
          response.status = 200;
        } else {
          response.status = 404;
        }
        var deferred = $q.defer();
        deferred.resolve(response);
        return deferred.promise;
      }            
    }

    $httpBackend.when('GET', '/profile')
                            .respond({ status: 200 });

    ctrl = $controller('loginCtrl', { $scope: $scope, AuthService: authServiceMock});

  }));

  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a loginCtrl', function() {
    expect(ctrl).to.not.be.undefined;
  });

  it('should verify getAllUsers service exists', inject(function() {
    $scope.$digest();
    expect(authServiceMock.login).to.exist;;
  }));

  it('should return 200 with a "valid" password and username', inject(function() {
    loginForm.email = 'test@test.test';
    loginForm.password = 'testpassword';
    $scope.loginForm = loginForm;
    expect($scope.login()).to.equal(true);
    
  }));

  it('should return 404 with an "invalid" password and username', inject(function() {
    loginForm.email = 'test@test.test';
    loginForm.password = '';
    $scope.loginForm = loginForm;
    $scope.login();
  }))


});
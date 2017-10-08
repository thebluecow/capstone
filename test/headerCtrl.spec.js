describe("Unit Testing headerCtrl", function() {

  beforeEach(angular.mock.module('ijwApp'));
  
  beforeEach(inject(function(_$controller_,_$rootScope_,_$log_,_$location_) {
    $controller = _$controller_;
    $scope = _$rootScope_.$new();
    $log = _$log_;
    $location = _$location_;
    

  }));
  
  it('should pass a simple test: true = true', function() {
   expect(true).to.equal(true);
   });

  it('should have a headerCtrl', function() {
    const ctrl = $controller('headerCtrl',{$scope:$scope, $log:$log, $location:$location});
    expect(ctrl).to.not.be.undefined;
  });

  it('should return $location.path()', function() {
    const ctrl = $controller('headerCtrl',{$scope:$scope, $log:$log, $location:$location});
    expect($scope.isActive()).to.equal(false);
  });

  it("should load the page.", inject(function ($route, $httpBackend) {
        $httpBackend.whenGET("/home").respond("<div/>");
        $location.path("/home");
        $scope.$digest();
        expect($location.path()).to.equal("/home");
    }));

});
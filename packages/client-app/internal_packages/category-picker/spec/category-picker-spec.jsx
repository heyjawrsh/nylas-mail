/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const _ = require("underscore");
const _React = require("react");
const ReactDOM = require("react-dom");
const ReactTestUtils = require("react-addons-test-utils");
const CategoryPickerPopover = require("../lib/category-picker-popover").default;

const {
	Utils,
	Category,
	Thread,
	Actions,
	AccountStore,
	CategoryStore,
	DatabaseStore,
	TaskFactory,
	SyncbackCategoryTask,
	FocusedPerspectiveStore,
	MailboxPerspective,
	NylasTestUtils,
	TaskQueueStatusStore,
} = require("nylas-exports");

const { Categories } = require("nylas-observables");

describe("CategoryPickerPopover", () => {
	beforeEach(() => (CategoryStore._categoryCache = {}));

	afterEach(() => (NylasEnv.testOrganizationUnit = null));

	const setupFor = function (organizationUnit) {
		NylasEnv.testOrganizationUnit = organizationUnit;
		this.account = {
			id: TEST_ACCOUNT_ID,
			usesLabels() {
				return organizationUnit === "label";
			},
			usesFolders() {
				return organizationUnit !== "label";
			},
		};

		this.inboxCategory = new Category({
			id: "id-123",
			name: "inbox",
			displayName: "INBOX",
			accountId: TEST_ACCOUNT_ID,
		});
		this.archiveCategory = new Category({
			id: "id-456",
			name: "archive",
			displayName: "ArCHIVe",
			accountId: TEST_ACCOUNT_ID,
		});
		this.userCategory = new Category({
			id: "id-789",
			name: null,
			displayName: "MyCategory",
			accountId: TEST_ACCOUNT_ID,
		});

		const observable = NylasTestUtils.mockObservable([
			this.inboxCategory,
			this.archiveCategory,
			this.userCategory,
		]);
		observable.sort = () => observable;

		spyOn(Categories, "forAccount").andReturn(observable);
		spyOn(CategoryStore, "getStandardCategory").andReturn(this.inboxCategory);
		spyOn(AccountStore, "accountForItems").andReturn(this.account);
		spyOn(Actions, "closePopover");

		// By default we're going to set to "inbox". This has implications for
		// what categories get filtered out of the list.
		return spyOn(FocusedPerspectiveStore, "current").andCallFake(() => {
			return MailboxPerspective.forCategory(this.inboxCategory);
		});
	};

	const setupForCreateNew = function (orgUnit) {
		if (orgUnit == null) {
			orgUnit = "folder";
		}
		setupFor.call(this, orgUnit);

		this.testThread = new Thread({
			id: "t1",
			subject: "fake",
			accountId: TEST_ACCOUNT_ID,
			categories: [],
		});
		return (this.picker = ReactTestUtils.renderIntoDocument(
			<CategoryPickerPopover
				threads={[this.testThread]}
				account={this.account}
			/>,
		));
	};

	describe("when using labels", () =>
		beforeEach(function () {
			return setupFor.call(this, "label");
		}));

	describe("when using folders", () => {
		beforeEach(function () {
			setupFor.call(this, "folder");

			this.testThread = new Thread({
				id: "t1",
				subject: "fake",
				accountId: TEST_ACCOUNT_ID,
				categories: [],
			});
			return (this.picker = ReactTestUtils.renderIntoDocument(
				<CategoryPickerPopover
					threads={[this.testThread]}
					account={this.account}
				/>,
			));
		});

		return it("lists the desired categories", function () {
			const data = this.picker.state.categoryData;
			// NOTE: The inbox category is not included here because it's the
			// currently focused category, which gets filtered out of the list.
			expect(data.length).toBe(3);

			expect(data[0].id).toBe("id-456");
			expect(data[0].name).toBe("archive");
			expect(data[0].category).toBe(this.archiveCategory);

			expect(data[1].divider).toBe(true);
			expect(data[1].id).toBe("category-divider");

			expect(data[2].id).toBe("id-789");
			expect(data[2].name).toBeUndefined();
			return expect(data[2].category).toBe(this.userCategory);
		});
	});

	describe("'create new' item", () => {
		beforeEach(function () {
			return setupForCreateNew.call(this);
		});

		afterEach(() => (NylasEnv.testOrganizationUnit = null));

		it("is not visible when the search box is empty", function () {
			const count = ReactTestUtils.scryRenderedDOMComponentsWithClass(
				this.picker,
				"category-create-new",
			).length;
			return expect(count).toBe(0);
		});

		it("is visible when the search box has text", function () {
			const inputNode = ReactDOM.findDOMNode(
				ReactTestUtils.scryRenderedDOMComponentsWithTag(
					this.picker,
					"input",
				)[0],
			);
			ReactTestUtils.Simulate.change(inputNode, {
				target: { value: "calendar" },
			});
			const count = ReactTestUtils.scryRenderedDOMComponentsWithClass(
				this.picker,
				"category-create-new",
			).length;
			return expect(count).toBe(1);
		});

		return it("shows folder icon if we're using exchange", function () {
			const inputNode = ReactDOM.findDOMNode(
				ReactTestUtils.scryRenderedDOMComponentsWithTag(
					this.picker,
					"input",
				)[0],
			);
			ReactTestUtils.Simulate.change(inputNode, {
				target: { value: "calendar" },
			});
			const count = ReactTestUtils.scryRenderedDOMComponentsWithClass(
				this.picker,
				"category-create-new-folder",
			).length;
			return expect(count).toBe(1);
		});
	});

	describe("'create new' item with labels", () => {
		beforeEach(function () {
			return setupForCreateNew.call(this, "label");
		});

		return it("shows label icon if we're using gmail", function () {
			const inputNode = ReactDOM.findDOMNode(
				ReactTestUtils.scryRenderedDOMComponentsWithTag(
					this.picker,
					"input",
				)[0],
			);
			ReactTestUtils.Simulate.change(inputNode, {
				target: { value: "calendar" },
			});
			const count = ReactTestUtils.scryRenderedDOMComponentsWithClass(
				this.picker,
				"category-create-new-tag",
			).length;
			return expect(count).toBe(1);
		});
	});

	return describe("_onSelectCategory", () => {
		beforeEach(function () {
			setupForCreateNew.call(this, "folder");
			spyOn(Actions, "applyCategoryToThreads");
			spyOn(Actions, "removeCategoryFromThreads");
			spyOn(Actions, "queueTask");
			return spyOn(Actions, "queueTasks");
		});

		it("closes the popover", function () {
			this.picker._onSelectCategory({ usage: 0, category: "asdf" });
			return expect(Actions.closePopover).toHaveBeenCalled();
		});

		describe("when selecting a category currently on all the selected items", () =>
			it("fires a task to remove the category", function () {
				const input = {
					category: "asdf",
					usage: 1,
				};

				this.picker._onSelectCategory(input);
				return expect(Actions.removeCategoryFromThreads).toHaveBeenCalledWith({
					threads: [this.testThread],
					source: "Category Picker: Existing Category",
					categoryToRemove: "asdf",
				});
			}));

		describe("when selecting a category not on all the selected items", () =>
			it("fires a task to add the category", function () {
				const input = {
					category: "asdf",
					usage: 0,
				};

				this.picker._onSelectCategory(input);
				return expect(Actions.applyCategoryToThreads).toHaveBeenCalledWith({
					source: "Category Picker: Existing Category",
					threads: [this.testThread],
					categoryToApply: "asdf",
				});
			}));

		return describe("when selecting a new category", () => {
			beforeEach(function () {
				this.input = { newCategoryItem: true };
				return this.picker.setState({ searchValue: "teSTing!" });
			});

			it("queues a new syncback task for creating a category", function () {
				this.picker._onSelectCategory(this.input);
				expect(Actions.queueTask).toHaveBeenCalled();
				const syncbackTask = Actions.queueTask.calls[0].args[0];
				const newCategory = syncbackTask.category;
				expect(newCategory instanceof Category).toBe(true);
				expect(newCategory.displayName).toBe("teSTing!");
				return expect(newCategory.accountId).toBe(TEST_ACCOUNT_ID);
			});

			return it("queues a task for applying the category after it has saved", function () {
				let category = false;
				let resolveSave = false;
				spyOn(TaskQueueStatusStore, "waitForPerformRemote").andCallFake(
					(task) => {
						expect(task instanceof SyncbackCategoryTask).toBe(true);
						return new Promise((resolve, _reject) => (resolveSave = resolve));
					},
				);

				spyOn(DatabaseStore, "findBy").andCallFake((klass, { clientId }) => {
					expect(klass).toBe(Category);
					expect(typeof clientId).toBe("string");
					return Promise.resolve(category);
				});

				this.picker._onSelectCategory(this.input);

				waitsFor(() => Actions.queueTask.callCount > 0);

				runs(() => {
					({ category } = Actions.queueTask.calls[0].args[0]);
					return resolveSave();
				});

				waitsFor(() => Actions.applyCategoryToThreads.calls.length === 1);

				return runs(function () {
					return expect(Actions.applyCategoryToThreads).toHaveBeenCalledWith({
						source: "Category Picker: New Category",
						threads: [this.testThread],
						categoryToApply: category,
					});
				});
			});
		});
	});
});

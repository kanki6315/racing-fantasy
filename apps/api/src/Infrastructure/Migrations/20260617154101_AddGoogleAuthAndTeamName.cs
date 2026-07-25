using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnduranceFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddGoogleAuthAndTeamName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_app_user_email",
                table: "app_user");

            migrationBuilder.RenameColumn(
                name: "email",
                table: "app_user",
                newName: "external_subject");

            migrationBuilder.RenameColumn(
                name: "display_name",
                table: "app_user",
                newName: "external_provider");

            migrationBuilder.AlterColumn<long>(
                name: "user_id",
                table: "registration",
                type: "bigint",
                nullable: true,
                oldClrType: typeof(long),
                oldType: "bigint");

            migrationBuilder.AddColumn<string>(
                name: "team_name",
                table: "registration",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_app_user_external_provider_external_subject",
                table: "app_user",
                columns: new[] { "external_provider", "external_subject" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_app_user_external_provider_external_subject",
                table: "app_user");

            migrationBuilder.DropColumn(
                name: "team_name",
                table: "registration");

            migrationBuilder.RenameColumn(
                name: "external_subject",
                table: "app_user",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "external_provider",
                table: "app_user",
                newName: "display_name");

            migrationBuilder.AlterColumn<long>(
                name: "user_id",
                table: "registration",
                type: "bigint",
                nullable: false,
                defaultValue: 0L,
                oldClrType: typeof(long),
                oldType: "bigint",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_app_user_email",
                table: "app_user",
                column: "email",
                unique: true);
        }
    }
}
